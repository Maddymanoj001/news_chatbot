import axios from 'axios';
import { config } from '../utils/config.js';

export const querySimilar = async ({ query, k = 5 }) => {
  const url = `${config.vectorServiceUrl}/query`;
  try {
    const { data } = await axios.post(url, { query, k }, { timeout: 15000 });
    return data; // { hits: [{text, score, source, id}], usedModel }
  } catch (e) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    const message = e?.message || String(e);
    const code = e?.code;
    const errno = e?.errno;
    const cause = e?.cause ? (e.cause.message || String(e.cause)) : undefined;
    const reqPath = e?.request?.path;
    const reqHost = e?.request?.host;
    const address = e?.address;
    const port = e?.port;
    const detail = {
      url,
      status,
      body,
      message,
      code,
      errno,
      cause,
      reqPath,
      reqHost,
      address,
      port,
    };
    throw new Error(JSON.stringify(detail));
  }
};

export default { querySimilar };
