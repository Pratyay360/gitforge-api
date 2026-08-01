FROM ghcr.io/nubjs/nub:slim
WORKDIR /app
COPY . .

EXPOSE 3000

RUN nub install

CMD ["nub", "run", "dev"]
