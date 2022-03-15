import express from "express";
import axios from "axios";
import cors from "cors";
import { createClient } from "redis";
import { RedisClientType } from "@node-redis/client";

import "dotenv/config";

let client: RedisClientType;

(async () => {
  client = createClient({ url: process.env.redis });
  client.on("error", (err) => console.log("Redis Client Error", err));
  await client.connect();
  //   console.log(await client.flushDb());
  //   console.log(await client.dbSize());
})();

const app = express();

const options: cors.CorsOptions = {
  origin: "*",
};
app.use(cors(options));

const port = 8080;

app.get("/:hash", async (req, res) => {
  const hash = req.params.hash;
  const data = await (
    await axios.get(
      `https://api.pinata.cloud/data/pinList?hashContains=${hash}`,
      {
        headers: {
          pinata_api_key: process.env.pinata_api_key as string,
          pinata_secret_api_key: process.env.pinata_secret_api_key as string,
        },
      }
    )
  ).data;
  res.send(data);
});

app.get("/metadata/:hash", async (req, res) => {
  const hash = req.params.hash;
  if (await client.exists(`metadata:${hash}`)) {
    res.send(JSON.parse((await client.get(`metadata:${hash}`)) as string));
  } else {
    const data = await (
      await axios.get(
        `https://api.pinata.cloud/data/pinList?hashContains=${hash}`,
        {
          headers: {
            pinata_api_key: process.env.pinata_api_key as string,
            pinata_secret_api_key: process.env.pinata_secret_api_key as string,
          },
        }
      )
    ).data;
    await client.set(
      `metadata:${hash}`,
      JSON.stringify({
        damage: data.rows[0].metadata.keyvalues.damage,
        health: data.rows[0].metadata.keyvalues.health,
        rarity: data.rows[0].metadata.keyvalues.rarity,
      })
    );
    res.send(JSON.parse((await client.get(`metadata:${hash}`)) as string));
  }
});

app.get("/ipfs/:hash", async (req, res) => {
  const hash = req.params.hash;
  if (await client.exists(`ipfs:${hash}`)) {
    res.send(
      Buffer.from((await client.get(`ipfs:${hash}`)) as string, "base64")
    );
  } else {
    try {
      const data: ArrayBuffer = await (
        await axios.get(`https://mygateway.mypinata.cloud/ipfs/${hash}`, {
          responseType: "arraybuffer",
        })
      ).data;
      res.set("Content-Type", "image/png");
      const base64String = Buffer.from(data).toString("base64");

      await client.set(`ipfs:${hash}`, base64String);
      res.send(
        Buffer.from((await client.get(`ipfs:${hash}`)) as string, "base64")
      );
    } catch (error) {
      console.log(error);
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
