This is a [Next.js](https://nextjs.org) Telegram Mini App project for **Corgi Buddy** - a TON cryptocurrency mini-app where users pair up to spot corgis and earn Corgi coins.

## Getting Started

This project uses **pnpm** exclusively. Install dependencies:

```bash
pnpm install
```

### Development

Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing in Telegram

To test the app inside Telegram, you need HTTPS:

```bash
pnpm run dev:https
```

Then submit `https://127.0.0.1:3000` to [@BotFather](https://t.me/botfather) and test in Telegram Web or desktop client.

### Development with Mock Data

To develop outside of Telegram with mock authentication data:

1. Create a `.env.local` file:
```bash
NEXT_PUBLIC_USE_MOCK_AUTH=true
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_bot_token_here
```

2. Run the development server:
```bash
pnpm run dev
```

The app will now use a mock Telegram user (Arthur, ID: 99281932) with properly signed initData. You can customize the mock user in `src/lib/mockAuth.ts`.

### Available Commands

- `pnpm run dev` - Run development server
- `pnpm run dev:https` - Run with HTTPS (for Telegram testing)
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run type-check` - Run TypeScript type checking
- `pnpm run validate` - Run both lint and type-check
- `pnpm run format` - Format code with Prettier
- `pnpm run test` - Run Jest tests
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:seed` - Seed initial data

## Docker Deployment

### Build the Docker Image

```bash
docker build -t tongi:latest .
```

### Run with Environment Variables

Create a `.env` file from the example template:

```bash
cp .env.example .env
```

Edit `.env` and configure your production values:
- Set `NODE_ENV=production`
- Set `NEXT_PUBLIC_USE_MOCK_AUTH=false`
- Configure your Telegram bot token
- Configure your TON wallet credentials
- Update other settings as needed

Run the container:

```bash
docker run -d \
  --name tongi \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  tongi:latest
```

## Docker Swarm Deployment (Production VPS)

For production deployment to a VPS using Docker Swarm for high availability and easier updates.

### Prerequisites

1. Docker installed on your VPS
2. Docker Swarm initialized:

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Initialize Swarm (run once)
docker swarm init --advertise-addr your-vps-ip
```

### Build and Prepare Image

Build the Docker image either on your VPS or locally and push to a registry:

**Option A: Build on VPS**
```bash
# Copy code to VPS (from local machine)
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude 'data' \
  . user@your-vps-ip:~/tongi/

# SSH into VPS and build
ssh user@your-vps-ip
cd ~/tongi
docker build -t tongi:latest .
```

**Option B: Use Docker Registry**
```bash
# Build locally and push to registry
docker build -t your-registry/tongi:latest .
docker push your-registry/tongi:latest

# Update docker-stack.yml to use: image: your-registry/tongi:latest
```

### Create Production Secrets

Create a `.env.production` file with your production environment variables:

```bash
# On your VPS
cat > .env.production <<EOF
TELEGRAM_BOT_TOKEN=your_bot_token
NEXT_PUBLIC_TON_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
BANK_WALLET_PRIVATE_KEY=your_private_key
# Add all required environment variables
EOF

# Create Docker secret (run once)
docker secret create tongi-env .env.production

# Remove the file for security
rm .env.production
```

To update secrets:
```bash
# Remove old secret
docker secret rm tongi-env

# Create new secret
docker secret create tongi-env .env.production
rm .env.production

# Update the service to use new secret
docker service update --secret-rm tongi-env --secret-add tongi-env tongi_tongi
```

### Run Database Migrations

Before first deployment, run migrations using the builder image:

```bash
# Create data volume manually (optional, Swarm will create it automatically)
docker volume create tongi-data

# Build the builder image (includes tsx and other dev dependencies)
docker build --target builder -t tongi:builder .

# Run migrations
docker run --rm \
  -v tongi-data:/app/data \
  --env-file .env \
  tongi:builder \
  pnpm run db:migrate
```

### Deploy the Stack

```bash
# Deploy using the stack file
docker stack deploy -c docker-stack.yml tongi

# Verify deployment
docker stack ps tongi
docker service ls

# Check logs
docker service logs -f tongi_tongi
```

### Monitor Deployment

```bash
# Watch service status
watch -n 2 docker service ls

# View detailed service info
docker service inspect tongi_tongi

# Check container health
docker service ps tongi_tongi

# Stream logs
docker service logs -f tongi_tongi --tail 100
```

### Update the Application

To deploy a new version:

```bash
# Build new image with version tag
docker build -t tongi:v2 .

# Update the service (rolling update)
docker service update --image tongi:v2 tongi_tongi

# Rollback if needed
docker service rollback tongi_tongi
```

### Backup Database

```bash
# Backup SQLite database from volume
docker run --rm \
  -v tongi-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/tongi-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Restore backup
docker run --rm \
  -v tongi-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/tongi-backup-YYYYMMDD-HHMMSS.tar.gz -C /data
```

### Remove Stack

```bash
# Remove the entire stack
docker stack rm tongi

# Remove volumes (WARNING: deletes data!)
docker volume rm tongi-data

# Remove secrets
docker secret rm tongi-env
```

### Important Notes

- **Volume Persistence**: The `tongi-data` volume persists across deployments. Always back it up before major updates.
- **Health Checks**: The service includes automatic health checks via `/api/health`. Unhealthy containers are automatically restarted.
- **Rolling Updates**: Updates happen with zero downtime using `start-first` order - new container starts before old one stops.
- **Resource Limits**: Configured with CPU (1 core max) and memory (512MB max) limits. Adjust in `docker-stack.yml` based on your VPS specs.

### Scaling Considerations

If you need to scale beyond 1 replica, you have two options:

1. **Migrate to PostgreSQL** - Replace SQLite with PostgreSQL for multi-instance support
2. **Read Replicas Pattern** - Run 1 writer service + multiple read-only API services (advanced)

## Project Structure

- `src/app/` - Next.js 15 App Router pages
- `src/components/` - React components (Auth, Buddy, Corgi, Wallet, etc.)
- `src/core/` - Core initialization and i18n
- `src/lib/` - Utility libraries (Telegram auth, mock auth, API errors, logger)
- `src/services/` - Business logic services (User, Buddy, Transaction, etc.)
- `specs/` - Feature specifications and design documents

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
