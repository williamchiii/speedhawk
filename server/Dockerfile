#uses node version 22 as our base image
FROM node:22

#goes to the app directory (like cd in terminal) (start in this point)
WORKDIR /app

#copies the dependencies
COPY package*.json ./

#installs depencies 
RUN npm install

#checks cache
COPY . .

#use port
ENV PORT=3001

#expose that port
EXPOSE 3001

#run command
CMD ["npm", "run", "dev", "--", "--host"]