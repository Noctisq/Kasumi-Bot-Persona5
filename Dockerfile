FROM node:12

WORKDIR /index

COPY package.json ./

RUN npm install

COPY . .

ENV TOKEN=NzM0ODc0ODgzMTg3NTM5OTc4.XxYDkQ.QodMqdw2rCPSINCzVAC4y3Bnhao

CMD [ "npm", "start", "kasumi" ]