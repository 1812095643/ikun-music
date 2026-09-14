import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_MUSIC}`;
const request = axios.create({
  baseURL,
  timeout: 10000
});

export default request;
