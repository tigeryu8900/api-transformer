import express from "express";
import bodyParser from "express";
import {Readable} from "stream";
import {ReadableStream} from "stream/web";

const app = express();

app.use(function (req, res, next) {
  if (!req.query["keep-headers"]) {
    req.headers = {};
  }
  if (req.query.headers) {
    if (typeof req.query.headers === "string") {
      Object.assign(req.headers, JSON.parse(req.query.headers));
    } else {
      const headers = {};
      for (const str of req.query.headers) {
        for (const [key, value] of Object.keys(JSON.parse(str))) {
          if (headers.hasOwnProperty(key.toLowerCase())) {
            headers[key.toLowerCase()] += `${
                key.toLowerCase() === "cookie" ? ";" : ","
            } ${value}`;
          } else {
            headers[key.toLowerCase()] = value;
          }
        }
      }
      Object.assign(req.headers, headers);
    }
  } else {
    if (typeof req.query.url === "string") {
      req.headers.host = new URL(req.query.url).host;
    } else {
      req.headers.host = new URL(req.query.url[0]).host;
    }
  }
  const contentType = req.query["content-type"];
  if (contentType) {
    if (typeof contentType === "string") {
      req.headers["content-type"] = contentType;
    } else {
      req.headers["content-type"] = contentType[0];
    }
  }
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({extended: true}));

app.all("/:method?", async (req, res) => {
  const requestTransform = req.query["request-transform"] ?? req.get(
      "request-transform");
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
  const response = await fetch(req.query.url, {
    method: req.params.method || req.method,
    headers: {
      ...req.headers
    },
    body: body
  });
  const responseTransform = req.query["response-transform"] ?? req.get(
      "response-transform");
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
