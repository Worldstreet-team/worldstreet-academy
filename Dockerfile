# Use Node 22 (adjust if needed)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm \
    && pnpm install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Build the Next.js app
RUN pnpm build

# Expose the port Next.js runs on
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]
