const DEFAULT_PORT = 3000;

function parsePort(value) {
  const port = Number(value);

  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return port;
  }

  return DEFAULT_PORT;
}

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT),
});
