# Server-Side Jetton Transfer Research: TON Blockchain

## Executive Summary

This document provides comprehensive research on programmatically transferring Jettons (TON's fungible token standard) from a server-controlled wallet using the `@ton/ton` SDK with private key signing. This is required for the Corgi Coin reward distribution system where the server needs to transfer Jettons from a bank wallet to user wallets.

## 1. Jetton Architecture Overview

### 1.1 Two-Contract System

Jettons on TON use a decentralized architecture with two types of smart contracts:

1. **Jetton Master Contract**: Manages token metadata, total supply, and provides getter methods
2. **Jetton Wallet Contracts**: Individual contracts for each user holding the token, storing their balance

### 1.2 Key Differences from Native TON Transfers

- **Native TON transfers**: Direct wallet-to-wallet transfers
- **Jetton transfers**: Must send message to sender's Jetton wallet contract, which then communicates with recipient's Jetton wallet contract
- **Gas fees**: Jetton transfers require more gas than native TON transfers (~0.037-0.05 TON)
- **Decimal precision**: Varies by token (USDT: 6 decimals, most Jettons: 9 decimals)

## 2. Core Transfer Process

### 2.1 Transfer Flow

```
1. Server Wallet → Sender's Jetton Wallet Contract (decrease balance)
2. Sender's Jetton Wallet → Recipient's Jetton Wallet Contract (increase balance)
3. Recipient's Jetton Wallet → Recipient (transfer notification, if forward_ton_amount > 0)
```

### 2.2 Message Structure (TEP-74 Standard)

Jetton transfers use opcode `0xf8a7ea5`:

```typescript
const transferBody = beginCell()
  .storeUint(0xf8a7ea5, 32)           // Opcode for jetton transfer
  .storeUint(0, 64)                    // query_id (0 for simple transfers, or unique ID for tracking)
  .storeCoins(jettonAmount)            // Amount in smallest units (e.g., 1 TON = 1_000_000_000)
  .storeAddress(destinationAddress)    // Recipient's TON wallet address
  .storeAddress(responseAddress)       // Address to receive excess TON (usually sender)
  .storeUint(0, 1)                     // custom_payload (null)
  .storeCoins(forwardTonAmount)        // forward_ton_amount (min 1 nanoton for notification)
  .storeBit(0)                         // forward_payload (empty, or 1 + ref for comment)
  .endCell();
```

## 3. Getting Jetton Wallet Address

### 3.1 Using JettonMaster Contract

Every user has a unique Jetton wallet address for each Jetton token type. To get a user's Jetton wallet address:

```typescript
import { Address, TonClient, beginCell } from '@ton/ton';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: 'YOUR_API_KEY'
});

async function getUserJettonWalletAddress(
  userAddress: string,
  jettonMasterAddress: string
): Promise<Address> {
  const userAddressCell = beginCell()
    .storeAddress(Address.parse(userAddress))
    .endCell();

  const response = await client.runMethod(
    Address.parse(jettonMasterAddress),
    'get_wallet_address',
    [{ type: 'slice', cell: userAddressCell }]
  );

  return response.stack.readAddress();
}
```

### 3.2 Using JettonMaster SDK Wrapper

```typescript
import { JettonMaster, TonClient } from '@ton/ton';

const jettonMaster = client.open(
  JettonMaster.create(Address.parse(jettonMasterAddress))
);

const jettonWalletAddress = await jettonMaster.getWalletAddress(
  Address.parse(userAddress)
);
```

## 4. Complete Server-Side Transfer Implementation

### 4.1 Required Dependencies

```json
{
  "@ton/ton": "latest",
  "@ton/crypto": "latest"
}
```

Note: The project currently only has `@tonconnect/sdk` and `@tonconnect/ui-react`. You'll need to add `@ton/ton` and `@ton/crypto` for server-side transfers.

### 4.2 Full Transfer Example

```typescript
import {
  WalletContractV5R1,
  Address,
  beginCell,
  internal,
  toNano,
  SendMode,
  TonClient
} from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

// Configuration
const JETTON_MASTER_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // Example
const BASE_JETTON_SEND_AMOUNT = toNano('0.05'); // Gas for transfer
const FORWARD_TON_AMOUNT = 1n; // 1 nanoton for transfer notification

// Initialize client
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TON_API_KEY
});

async function transferJettons(
  recipientAddress: string,
  jettonAmount: bigint,
  comment?: string
) {
  // 1. Derive wallet from mnemonic
  const mnemonics = process.env.BANK_WALLET_MNEMONIC!.split(' ');
  const keyPair = await mnemonicToPrivateKey(mnemonics);

  // 2. Create wallet contract
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });
  const contract = client.open(wallet);

  // 3. Get sender's Jetton wallet address
  const senderJettonWallet = await getUserJettonWalletAddress(
    wallet.address.toString(),
    JETTON_MASTER_ADDRESS
  );

  // 4. Build forward payload (optional comment)
  let forwardPayload = beginCell();
  if (comment) {
    forwardPayload
      .storeUint(0, 32) // Text comment opcode
      .storeStringTail(comment);
  }

  // 5. Build Jetton transfer body
  const transferBody = beginCell()
    .storeUint(0xf8a7ea5, 32)                              // Jetton transfer opcode
    .storeUint(0, 64)                                       // query_id
    .storeCoins(jettonAmount)                               // Amount
    .storeAddress(Address.parse(recipientAddress))          // Destination
    .storeAddress(wallet.address)                           // Response address (for excess)
    .storeUint(0, 1)                                        // custom_payload (null)
    .storeCoins(FORWARD_TON_AMOUNT)                         // Forward amount
    .storeBit(comment ? 1 : 0)                              // Has forward_payload
    .storeRef(comment ? forwardPayload.endCell() : beginCell().endCell())
    .endCell();

  // 6. Get sequence number
  const seqno = await contract.getSeqno();

  // 7. Send transfer
  await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: senderJettonWallet,
        value: BASE_JETTON_SEND_AMOUNT,
        body: transferBody,
        bounce: true
      })
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS
  });

  console.log('Jetton transfer sent successfully');
}

// Helper function from section 3.1
async function getUserJettonWalletAddress(
  userAddress: string,
  jettonMasterAddress: string
): Promise<Address> {
  const userAddressCell = beginCell()
    .storeAddress(Address.parse(userAddress))
    .endCell();

  const response = await client.runMethod(
    Address.parse(jettonMasterAddress),
    'get_wallet_address',
    [{ type: 'slice', cell: userAddressCell }]
  );

  return response.stack.readAddress();
}
```

### 4.3 Usage Example

```typescript
// Transfer 100 Corgi Coins (assuming 9 decimals)
await transferJettons(
  'UQBcGtGIHLIQJuUHRRfWLhQxUJF4p49ywJyBdDr7UKTK60p9',
  100_000_000_000n, // 100 tokens with 9 decimals
  'Reward for corgi sighting #123'
);
```

## 5. Checking Jetton Balance Before Transfer

### 5.1 Get Wallet Data

```typescript
async function getJettonBalance(
  ownerAddress: string,
  jettonMasterAddress: string
): Promise<bigint> {
  // 1. Get Jetton wallet address
  const jettonWallet = await getUserJettonWalletAddress(
    ownerAddress,
    jettonMasterAddress
  );

  // 2. Call get_wallet_data
  const result = await client.runMethod(
    jettonWallet,
    'get_wallet_data'
  );

  // 3. Parse response
  const balance = result.stack.readBigNumber();
  const ownerAddr = result.stack.readAddress();
  const jettonMaster = result.stack.readAddress();
  const jettonCode = result.stack.readCell();

  return balance;
}
```

### 5.2 Balance Verification Before Transfer

```typescript
async function safeTransferJettons(
  recipientAddress: string,
  jettonAmount: bigint,
  comment?: string
) {
  // Check bank wallet balance
  const bankBalance = await getJettonBalance(
    process.env.BANK_WALLET_ADDRESS!,
    JETTON_MASTER_ADDRESS
  );

  if (bankBalance < jettonAmount) {
    throw new Error(
      `Insufficient balance. Required: ${jettonAmount}, Available: ${bankBalance}`
    );
  }

  // Also check if bank wallet has enough TON for gas
  const tonBalance = await client.getBalance(
    Address.parse(process.env.BANK_WALLET_ADDRESS!)
  );

  if (tonBalance < BASE_JETTON_SEND_AMOUNT) {
    throw new Error(
      `Insufficient TON for gas. Required: ${BASE_JETTON_SEND_AMOUNT}, Available: ${tonBalance}`
    );
  }

  // Proceed with transfer
  await transferJettons(recipientAddress, jettonAmount, comment);
}
```

## 6. Gas Fees and Forward Amount

### 6.1 Gas Fee Calculation

- **Minimum gas**: ~0.037 TON for standard transfers
- **Recommended**: 0.05 TON (covers most scenarios including new wallet deployment)
- **Formula**: `TON_needed > transfer_amount + forward_ton_amount`

### 6.2 Forward Amount Requirements

```typescript
// Standard practice for ecosystem compatibility
const FORWARD_TON_AMOUNT = 1n; // 1 nanoton

// Why it matters:
// - forward_ton_amount > 0 → sends transfer notification to recipient
// - forward_ton_amount = 0 → silent transfer (no notification)
// - Ecosystem standard: 1 nanoton for withdrawals
```

### 6.3 Gas Considerations

- **New wallet deployment**: If recipient doesn't have a Jetton wallet, deployment costs ~0.02 TON extra
- **Large payloads**: Comments/custom data increase gas costs
- **Excess refund**: Set `response_destination` to your address to receive unused gas

## 7. Transaction Monitoring and Confirmation

### 7.1 Monitoring Strategy

```typescript
async function monitorTransaction(
  walletAddress: string,
  expectedQueryId?: bigint
): Promise<boolean> {
  // Poll getTransactions method
  const transactions = await client.getTransactions(
    Address.parse(walletAddress),
    { limit: 10 }
  );

  for (const tx of transactions) {
    // Check for transfer notification (op: 0x7362d09c)
    if (tx.inMessage?.body) {
      const slice = tx.inMessage.body.beginParse();
      const op = slice.loadUint(32);

      if (op === 0x7362d09c) { // Transfer notification
        const queryId = slice.loadUint(64);
        const amount = slice.loadCoins();
        const sender = slice.loadAddress();

        if (!expectedQueryId || queryId === expectedQueryId) {
          console.log(`Transfer confirmed: ${amount} tokens from ${sender}`);
          return true;
        }
      }
    }
  }

  return false;
}
```

### 7.2 Transaction Confirmation

- **Irreversible after 1 confirmation**: TON transactions are final after one block
- **No need to wait**: Unlike some blockchains, 1 confirmation is sufficient
- **Query ID tracking**: Use unique query_id to match outgoing transfers with confirmations

### 7.3 Monitoring Incoming Jetton Transfers

```typescript
async function detectIncomingJettons(
  jettonWalletAddress: string
): Promise<Array<{ amount: bigint, sender: Address, comment?: string }>> {
  const transfers: Array<{ amount: bigint, sender: Address, comment?: string }> = [];
  const transactions = await client.getTransactions(
    Address.parse(jettonWalletAddress),
    { limit: 20 }
  );

  for (const tx of transactions) {
    if (tx.inMessage?.body) {
      const slice = tx.inMessage.body.beginParse();
      const op = slice.loadUint(32);

      // Internal transfer from another jetton wallet (op: 0x178d4519)
      if (op === 0x178d4519) {
        const queryId = slice.loadUint(64);
        const amount = slice.loadCoins();
        const sender = slice.loadAddress();

        // Try to read forward_payload for comment
        let comment: string | undefined;
        try {
          slice.loadAddress(); // response_destination
          const forwardPayload = slice.loadBit() ? slice.loadRef() : slice;
          const textOp = forwardPayload.loadUint(32);
          if (textOp === 0) {
            comment = forwardPayload.loadStringTail();
          }
        } catch (e) {
          // No comment or parsing error
        }

        transfers.push({ amount, sender, comment });
      }
    }
  }

  return transfers;
}
```

## 8. Batch Transfers with Highload Wallet V3

### 8.1 When to Use Highload Wallet

- **High volume**: Processing many transfers (10+ per minute)
- **Cost efficiency**: Batch up to 254 messages in one external message
- **Recommended for**: Exchanges, reward distribution systems, airdrops

### 8.2 Highload V3 Setup

```typescript
// Note: Requires separate package
// npm install @ton-community/highload-wallet-contract-v3

import { HighloadWalletV3 } from '@ton-community/highload-wallet-contract-v3';

const SUBWALLET_ID = 0x10ad; // Recommended for Jetton operations

async function createHighloadWallet() {
  const keyPair = await mnemonicToPrivateKey(mnemonics);

  const wallet = HighloadWalletV3.create({
    publicKey: keyPair.publicKey,
    subwalletId: SUBWALLET_ID,
    workchain: 0
  });

  return wallet;
}
```

### 8.3 Batch Jetton Transfer

```typescript
async function batchTransferJettons(
  recipients: Array<{ address: string, amount: bigint, comment?: string }>
) {
  const wallet = await createHighloadWallet();
  const messages = [];

  for (const recipient of recipients) {
    const transferBody = beginCell()
      .storeUint(0xf8a7ea5, 32)
      .storeUint(0, 64)
      .storeCoins(recipient.amount)
      .storeAddress(Address.parse(recipient.address))
      .storeAddress(wallet.address)
      .storeUint(0, 1)
      .storeCoins(1n)
      .storeBit(recipient.comment ? 1 : 0)
      .storeRef(
        recipient.comment
          ? beginCell().storeUint(0, 32).storeStringTail(recipient.comment).endCell()
          : beginCell().endCell()
      )
      .endCell();

    messages.push(
      internal({
        to: senderJettonWallet,
        value: BASE_JETTON_SEND_AMOUNT,
        body: transferBody,
        bounce: true
      })
    );
  }

  // Send batch (implementation depends on Highload V3 wrapper)
  // See: https://github.com/ton-blockchain/highload-wallet-contract-v3
}
```

### 8.4 Highload V3 Resources

- **GitHub**: https://github.com/ton-blockchain/highload-wallet-contract-v3
- **Examples**: Jetton withdrawal and batch withdrawal examples in toncenter/examples repo
- **Message limit**: 8,380,415 messages per timeout period
- **Query ID**: Uses composite structure (shift: 0-8191, bitnumber: 0-1022)

## 9. Production Best Practices

### 9.1 Security

1. **Never expose private keys**: Store mnemonics in secure environment variables
2. **Server-side validation**: Always validate Telegram initData before processing rewards
3. **Rate limiting**: Implement transfer rate limits to prevent abuse
4. **Audit logging**: Log all Jetton transfers for accountability
5. **Balance checks**: Always verify sufficient balance before transfers

### 9.2 Error Handling

```typescript
async function robustTransferJettons(
  recipientAddress: string,
  jettonAmount: bigint,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await safeTransferJettons(recipientAddress, jettonAmount);
      return { success: true };
    } catch (error) {
      console.error(`Transfer attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
}
```

### 9.3 Monitoring and Alerts

1. **Balance monitoring**: Alert when bank wallet balance falls below threshold
2. **Failed transfers**: Track and retry failed transfers
3. **Gas price monitoring**: Adjust gas amounts based on network conditions
4. **Transaction confirmation**: Verify all transfers completed successfully

### 9.4 Performance Optimization

1. **Connection pooling**: Reuse TonClient instances
2. **Batch processing**: Use Highload V3 for bulk transfers
3. **Async operations**: Process transfers asynchronously
4. **Cache Jetton wallet addresses**: Store user Jetton wallet addresses to avoid repeated lookups

## 10. Integration Checklist for Corgi Coin

### 10.1 Prerequisites

- [ ] Add `@ton/ton` and `@ton/crypto` to package.json
- [ ] Deploy Corgi Coin Jetton master contract (or get address)
- [ ] Set up bank wallet with initial Corgi Coin supply
- [ ] Store bank wallet mnemonic securely in environment variables
- [ ] Set up TON API key (from https://t.me/tonapibot)

### 10.2 Implementation Steps

1. **Create Jetton transfer utility** (`src/lib/ton/jetton-transfer.ts`)
   - Implement `transferJettons()` function
   - Implement `getJettonBalance()` function
   - Implement `getUserJettonWalletAddress()` function

2. **Add balance checking** before transfers
   - Check bank wallet Jetton balance
   - Check bank wallet TON balance (for gas)
   - Throw descriptive errors if insufficient

3. **Implement transaction monitoring**
   - Track transfer confirmations
   - Log all transfers to database
   - Set up alerts for failures

4. **Create API endpoint** (`/api/corgi/distribute-reward`)
   - Validate user authentication
   - Check corgi sighting confirmation
   - Calculate reward amount
   - Execute Jetton transfer
   - Record transaction in database

### 10.3 Environment Variables

```bash
# .env.local
BANK_WALLET_MNEMONIC="word1 word2 ... word24"
BANK_WALLET_ADDRESS="EQxxx..."
CORGI_COIN_JETTON_MASTER="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
TON_API_KEY="your_api_key"
TON_ENDPOINT="https://toncenter.com/api/v2/jsonRPC"
```

### 10.4 Testing Strategy

1. **Testnet first**: Deploy on testnet, use test TON for gas
2. **Small amounts**: Test with minimal Jetton amounts
3. **Error scenarios**: Test insufficient balance, invalid addresses
4. **Monitor gas costs**: Track actual gas usage vs estimates
5. **Batch testing**: Test multiple transfers in sequence

## 11. Key Takeaways

1. **Jetton transfers are NOT direct**: Must interact with Jetton wallet smart contracts
2. **Always get Jetton wallet address first**: Use `get_wallet_address` on master contract
3. **Gas fees are significant**: Budget 0.05 TON per transfer
4. **Forward amount matters**: Set to 1 nanoton for ecosystem compatibility
5. **Balance checking is critical**: Verify both Jetton and TON balance before transfers
6. **Transaction monitoring**: Use query_id to track transfer confirmations
7. **Highload V3 for scale**: Use for high-volume transfer operations
8. **Security first**: Never expose private keys, validate all inputs

## 12. Additional Resources

- **TON Console Jetton Transfer Guide**: https://docs.tonconsole.com/tonapi/cookbook/jetton-transfer
- **TON Official Jetton Docs**: https://docs.ton.org/v3/guidelines/dapps/asset-processing/jettons
- **TEP-74 Jetton Standard**: https://github.com/ton-blockchain/TIPs/issues/74
- **Highload Wallet V3**: https://github.com/ton-blockchain/highload-wallet-contract-v3
- **@ton/ton SDK**: https://www.npmjs.com/package/@ton/ton
- **TON API Bot**: https://t.me/tonapibot
