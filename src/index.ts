import api from "./api";
import websocketApi from "./websocket";

const apiPort = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3000;
const websocketPort = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 3001;

api.listen(apiPort);
websocketApi.listen(websocketPort);