FROM node:20-slim

RUN apt-get update \
  && apt-get install -y python3 python3-pip curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x ./scripts/download-ml-assets.sh

EXPOSE 3000
CMD ["node", "server.js"]
