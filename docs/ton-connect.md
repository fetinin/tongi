```md
The [UI React SDK](/v3/guidelines/ton-connect/guidelines/developers#ton-connect-react) is the recommended option for React apps. It provides a high-level React component to interact with TON Connect.

Implementation
--------------

### Installation

To start integrating TON Connect into your DApp, you need to install the `@tonconnect/ui-react` package:

### Set up TON Connect

After installing the package, you should create a `tonconnect-manifest.json` file for your application. More information on creating a `tonconnect-manifest.json` file can be found [here](/v3/guidelines/ton-connect/creating-manifest).

After creating the manifest file, import `TonConnectUIProvider` into the root of your app and pass the manifest URL:

    import { TonConnectUIProvider } from '@tonconnect/ui-react';
    
    export function App() {
        return (
            <TonConnectUIProvider manifestUrl="https://<YOUR_APP_URL>/tonconnect-manifest.json">
                { /* Your app */ }
            </TonConnectUIProvider>
        );
    }

### Connect to the wallet

Add the `TonConnectButton`.

The `TonConnectButton` is a universal UI component for initializing a connection. After the wallet is connected, it transforms into a wallet menu. Place the **Connect** button in the top right corner of your app.

You can add the `className` and `style` props to the button:

    <TonConnectButton className="my-button-class" style={{ float: "right" }}/>

Note that you cannot pass children to the `TonConnectButton`.

You can always initiate the connection manually using the `useTonConnectUI` hook and [openModal](https://github.com/ton-connect/sdk/tree/main/packages/ui#open-connect-modal) method.

#### Connect with a specific wallet

To open a modal window for a specific wallet, use the `openSingleWalletModal()` method. This method takes the wallet's `app_name` as a parameter (refer to the [wallets-v2.json](https://github.com/ton-blockchain/wallets-list/blob/main/wallets-v2.json) file) and opens the corresponding wallet modal.

    import { useTonConnectUI } from '@tonconnect/ui-react';
    
    export const ConnectSpecificWallet = () => {
      const [tonConnectUI] = useTonConnectUI();
    
      return (
        <button onClick={() => tonConnectUI.openSingleWalletModal('tonwallet')}>
          Connect Wallet
        </button>
      );
    };

### Redirects

If you want to redirect the user to a specific page after wallet connection, you can use the `useTonConnectUI` hook and [customize your return strategy](https://github.com/ton-connect/sdk/tree/main/packages/ui#add-the-return-strategy).

#### Telegram Mini Apps

If you want to redirect the user to a [Telegram Mini App](/v3/guidelines/dapps/tma/overview) after wallet connection, you can customize the `TonConnectUIProvider` element:

    <TonConnectUIProvider
                // ... other parameters
              actionsConfiguration={{
                  twaReturnUrl: 'https://t.me/YOUR_APP_NAME'
              }}
          >
          </TonConnectUIProvider>

[Open example on GitHub](https://github.com/ton-connect/demo-dapp-with-react-ui)

### UI customization

To [customize the UI](https://github.com/ton-connect/sdk/tree/main/packages/ui#ui-customisation) of the modal, you can use the `useTonConnectUI` hook and the `setOptions` function. See more about the `useTonConnectUI` hook in the [Hooks](#hooks) section.

Hooks
-----

If you want to use some low-level TON Connect UI SDK features in your React app, you can use hooks from the `@tonconnect/ui-react` package.

### useTonAddress

Use it to get the user's current TON wallet address. Pass the boolean parameter `isUserFriendly` to choose the address format, where `isUserFriendly` is `true` by default. The hook will return an empty string if the wallet is not connected.

    import { useTonAddress } from '@tonconnect/ui-react';
    
    export const Address = () => {
      const userFriendlyAddress = useTonAddress();
      const rawAddress = useTonAddress(false);
    
      return (
        userFriendlyAddress && (
          <div>
            <span>User-friendly address: {userFriendlyAddress}</span>
            <span>Raw address: {rawAddress}</span>
          </div>
        )
      );
    };

### useTonConnectModal

Use this hook to access the functions for opening and closing the modal window. The hook returns an object with the current modal state and methods to open and close the modal.

    import { useTonConnectModal } from '@tonconnect/ui-react';
    
    export const ModalControl = () => {
        const { state, open, close } = useTonConnectModal();
    
        return (
          <div>
              <div>Modal state: {state?.status}</div>
              <button onClick={open}>Open modal</button>
              <button onClick={close}>Close modal</button>
          </div>
        );
    };

### useTonWallet

Use this hook to retrieve the user's current TON wallet. The hook will return `null` if the wallet is not connected. The `wallet` object provides common data such as the user's address, provider, [TON proof](/v3/guidelines/ton-connect/verifying-signed-in-users), and other attributes (see the [Wallet interface](https://ton-connect.github.io/sdk/interfaces/_tonconnect_sdk.Wallet.html)).

Additionally, you can access more specific details about the connected wallet, such as its name, image, and other attributes (refer to the [WalletInfo interface](https://ton-connect.github.io/sdk/types/_tonconnect_sdk.WalletInfo.html)).

    import { useTonWallet } from '@tonconnect/ui-react';
    
    export const Wallet = () => {
      const wallet = useTonWallet();
    
      return (
        wallet && (
          <div>
            <span>Connected wallet address: {wallet.account.address}</span>
            <span>Device: {wallet.device.appName}</span>
            <span>Connected via: {wallet.provider}</span>
            {wallet.connectItems?.tonProof?.proof && <span>TON proof: {wallet.connectItems.tonProof.proof}</span>}
    
            <div>Connected wallet info:</div>
            <div>
              {wallet.name} <img src={wallet.imageUrl} />
            </div>
          </div>
        )
      );
    };

### useTonConnectUI

Access the `TonConnectUI` instance and a function to update UI options.

[See more about TonConnectUI instance methods](https://github.com/ton-connect/sdk/tree/main/packages/ui#send-transaction)

[See more about the `setOptions` function](https://github.com/ton-connect/sdk/tree/main/packages/ui#change-options-if-needed)

    import { Locales, useTonConnectUI } from '@tonconnect/ui-react';
    
    export const Settings = () => {
      const [tonConnectUI, setOptions] = useTonConnectUI();
    
      const onLanguageChange = (language: Locales) => {
        setOptions({ language });
      };
    
      return (
        <div>
          <label>language</label>
          <select onChange={(e) => onLanguageChange(e.target.value as Locales)}>
            <option value="en">en</option>
            <option value="ru">ru</option>
          </select>
        </div>
      );
    };

### useIsConnectionRestored

`useIsConnectionRestored` indicates the current status of the connection restoring process. You can use it to detect when the connection restoring process is finished.

    import { useIsConnectionRestored } from '@tonconnect/ui-react';
    
    export const EntrypointPage = () => {
      const connectionRestored = useIsConnectionRestored();
    
      if (!connectionRestored) {
        return <Loader>Please wait...</Loader>;
      }
    
      return <MainPage />;
    };

Usage
-----

Let's look at how to use the React UI SDK in practice.

### Sending transactions

Send Toncoin to a specific address:

    import { useTonConnectUI } from '@tonconnect/ui-react';
    
    const transaction: SendTransactionRequest = {
      validUntil: Math.floor(Date.now() / 1000) + 600, // 5 minutes
      messages: [
        {
          address:
            "0QD-SuoCHsCL2pIZfE8IAKsjc0aDpDUQAoo-ALHl2mje04A-", // message destination in user-friendly format
          amount: "20000000", // Toncoin in nanotons
        },
      ],
    };
    
    export const Settings = () => {
      const [tonConnectUI, setOptions] = useTonConnectUI();
    
      return (
        <div>
          <button onClick={() => tonConnectUI.sendTransaction(transaction)}>
            Send transaction
          </button>
        </div>
      );
    };

### Understanding transaction status by hash

Check out the [Transaction lookup](/v3/guidelines/ton-connect/guidelines/transaction-by-external-message) page for more details.

### Optional check on the backend: ton\_proof

To ensure that the user truly owns the declared address, you can use `ton_proof`. This feature is particularly useful for verifying ownership of off-chain assets such as Telegram usernames or virtual phone numbers on platforms like Fragment.

Use the `tonConnectUI.setConnectRequestParameters` function to set up your connection request parameters. You can use it for:

*   Loading state: Show a loading state while waiting for a response from your backend.
*   Ready state with `ton_proof`: Set the state to 'ready' and include the `ton_proof` value.
*   If an error occurs, remove the loader and create the connect request without additional parameters.

    const [tonConnectUI] = useTonConnectUI();
    
    // Set loading state
    tonConnectUI.setConnectRequestParameters({ state: "loading" });
    
    // Fetch tonProofPayload from the backend
    const tonProofPayload: string | null =
      await fetchTonProofPayloadFromBackend();
    
    if (tonProofPayload) {
      // Set ready state with tonProof
      tonConnectUI.setConnectRequestParameters({
        state: "ready",
        value: { tonProof: tonProofPayload },
      });
    } else {
      // Remove loader
      tonConnectUI.setConnectRequestParameters(null);
    }

#### Handling ton\_proof result

You can find the `ton_proof` result in the `wallet` object when the wallet is connected:

    useEffect(() => {
        tonConnectUI.onStatusChange((wallet) => {
          if (
            wallet.connectItems?.tonProof &&
            "proof" in wallet.connectItems.tonProof
          ) {
            checkProofInYourBackend(
              wallet.connectItems.tonProof.proof,
              wallet.account.address
            );
          }
        });
      }, [tonConnectUI]);

#### Structure of ton\_proof

    type TonProofItemReplySuccess = {
      name: "ton_proof";
      proof: {
        timestamp: string; // Unix epoch time (seconds)
        domain: {
          lengthBytes: number; // Domain length
          value: string;  // Domain name
        };
        signature: string; // Base64-encoded signature
        payload: string; // Payload from the request
      }
    }

You can find an example of authentication on this [page](/v3/guidelines/ton-connect/verifying-signed-in-users#react-example).

### Wallet disconnection

Call to disconnect the wallet:

    const [tonConnectUI] = useTonConnectUI();
    
    await tonConnectUI.disconnect();

#### Deploying contract

Deploying a contract using TON Connect is pretty straightforward. You must:

*   Obtain the contract `code` and `data`
*   Store them as a `stateInit` cell
*   Send a transaction using the `stateInit` field provided

Note that `CONTRACT_CODE` and `CONTRACT_INIT_DATA` may be found in wrappers.

    import { beginCell, Cell, contractAddress, StateInit, storeStateInit } from '@ton/core';
    
    const [tonConnectUI] = useTonConnectUI();
    
    const init = {
        code: Cell.fromBase64('<CONTRACT_CODE>'),
        data: Cell.fromBase64('<CONTRACT_INIT_DATA>')
    } satisfies StateInit;
    
    const stateInit = beginCell()
        .store(storeStateInit(init))
        .endCell();
    
    const address = contractAddress(0, init);
    
    await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // 5 minutes
        messages: [
            {
                address: address.toRawString(),
                amount: '5000000',
                stateInit: stateInit.toBoc().toString('base64')
            }
        ]
    });

Wrappers
--------

Wrappers are classes that simplify interaction with the contract, allowing you to work without concerning yourself with the underlying details.

*   When developing a contract in FunC, write the wrapper yourself.
*   When using the [Tact language](https://docs.tact-lang.org), wrappers are automatically generated for you.

Let's take a look at the default `Blueprint` counter wrapper example and how we can use it:

### Wrappers for jettons and NFTs

To interact with jettons or NFTs, you can use [assets-sdk](https://github.com/ton-community/assets-sdk). This SDK provides wrappers that simplify interaction with these assets. Please check our [examples](https://github.com/ton-community/assets-sdk/tree/main/examples) section for practical examples.

API documentation
-----------------

[Latest API documentation](https://ton-connect.github.io/sdk/modules/_tonconnect_ui-react.html)

Example app is located in ./telegram_webapp_example folder of this project. 
