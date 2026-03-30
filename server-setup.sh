#!/bin/bash
# Server Setup Script - Run this on your Linux server
# SSH into: ssh deploy@206.189.134.117

# 1. Create .ssh directory with correct permissions
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 2. Add the new CI/CD public key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINGDjcFYwSiUlSmBXVdiJ6zMaeB9EK0Gt8igg7/4Go4G fxincap-cicd-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 3. Verify keys are in place
echo "=== Authorized Keys ==="
cat ~/.ssh/authorized_keys

# 4. Create deployment directories
mkdir -p /var/www/fxincap-staging
mkdir -p /var/www/fxincap
chmod 755 /var/www/fxincap-staging
chmod 755 /var/www/fxincap

# 5. Verify directory ownership
echo "=== Directory Ownership ==="
ls -ld /var/www/fxincap-staging /var/www/fxincap

# 6. Install required tools if not present
echo "=== Checking Node.js ==="
node -v || echo "Node.js not found"

echo "=== Checking pnpm ==="
pnpm -v || echo "pnpm not found - installing..."
npm install -g pnpm

echo "=== Checking PM2 ==="
pm2 -v || echo "PM2 not found - installing..."
npm install -g pm2
pm2 startup
pm2 save

echo "=== Setup Complete ==="
