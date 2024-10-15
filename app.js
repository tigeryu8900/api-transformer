import express from "express";
import bodyParser from "express";
import {Readable} from "stream";
import fetch from "node-fetch";
import {ReadableStream} from "stream/web";

const app = express();

app.use(function (req, res, next) {
  req.new_headers = {};
  if (!req.get("headers") || req.get("keep-headers")) {
    for (const [name, value] of Object.entries(req.headers)) {
      if (!name.startsWith("x-") && name !== "host" && name !== "accept-encoding") {
        req.new_headers[name] = value;
      }
    }
  }
  if (req.get("headers")) {
    Object.assign(req.new_headers, JSON.parse(req.get("headers")));
  }
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({extended: true}));

app.all("/:method(\\w*)/:url([\\w\\W]*)", async (req, res) => {
  const requestTransform = req.get("request-transform");
  if (requestTransform) {
    if (typeof requestTransform === "string") {
      eval(requestTransform);
    } else {
      for (const str of requestTransform) {
        eval(str);
      }
    }
  }
  const method = (req.params.method || req.method).toLowerCase();
  let body = null;
  if (method !== "get" && method !== "head") {
    switch (req.get("content-type")) {
      case "text/plain":
        body = req.body;
        break;
      case "application/json":
        body = JSON.stringify(req.body);
        break;
      case "application/octet-stream":
        body = req.body;
        break;
      default:
        body = String(req.body);
    }
  }
  const url = Object.keys(req.query).length
      ? `${req.params.url}?${new URLSearchParams(req.query)}` : req.params.url;
  console.log(req.new_headers);
  const response = await fetch(url, {
    method: req.params.method || req.method,
    headers: req.new_headers,
    body: body
  });
  const responseTransform = req.get("response-transform");
  if (responseTransform) {
    if (typeof responseTransform === "string") {
      eval(responseTransform);
    } else {
      for (const str of responseTransform) {
        eval(str);
      }
    }
  } else {
    for (const [name, value] of response.headers.entries()) {
      if (![
        "content-encoding",
        "content-length",
        "etag"
      ].includes(name.toLowerCase())) {
        res.setHeader(
            name.toLowerCase().startsWith("renamed-") ? name.substring(
                "renamed-".length) : name, value);
      }
    }
    res.status(response.status);
    Readable.fromWeb(ReadableStream.from(response.body)).pipe(res);
  }
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
