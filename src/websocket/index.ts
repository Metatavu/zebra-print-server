import WebSocket from "ws";
import https from 'https';
import { readFileSync } from 'fs';

const PRINTER_REMOVAL_TIMEOUT = process.env.PRINTER_TIMEOUT ? parseInt(process.env.PRINTER_TIMEOUT) : 5000;

interface Printer {
  socket: WebSocket,
  id: string,
  friendlyName: string,
  deleteTimer: any,
  connected: boolean
}

interface PrinterRepresentation {
  id: string,
  friendlyName: string
}

class WebsocketApi {

  private webSocketServer = https.createServer({
    cert: readFileSync(process.env.CERT_PATH || ""),
    key: readFileSync(process.env.CERT_KEY_PATH || "")
  });

  private wss = new WebSocket.Server({ server: this.webSocketServer });
  private printers: { [ key: string ]: Printer; } = {};

  constructor() {
    this.wss.on("connection", this.onWebsocketConnection.bind(this));
  }

  getConnectedPrinters(): PrinterRepresentation[] {
    const printerList: PrinterRepresentation[] = [];
    const keys = Object.keys(this.printers);
    keys.forEach((key: string) => {
      let printer = this.printers[key];
      printerList.push({id: printer.id, friendlyName: printer.friendlyName });
    })
    return printerList;
  }

  sendCommand(printerId: string, command: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const printer = this.printers[printerId];
      if (!printer) {
        return reject(false);
      }
  
      if (printer.connected) {
        printer.socket.send(Buffer.from(command));
        return resolve(true);
      }

      setTimeout(() => {
        if (!this.printers[printerId] || !this.printers[printerId].connected) {
          return reject(false);
        }

        this.printers[printerId].socket.send(Buffer.from(command));
        return resolve(true);
      }, PRINTER_REMOVAL_TIMEOUT);
    });
  }

  listen(port: number) {
    this.webSocketServer.listen(port);
    console.log(`Websocket server listening to port: ${port}`)
  }

  private onWebsocketConnection(socket: WebSocket) {
    console.log("Websocket connected");
    socket.once("message", (data) => {
      this.onInitialWebsocketMessage(socket, data);
    });
  }

  private onInitialWebsocketMessage(socket: WebSocket, msg: WebSocket.Data) {
    const data = JSON.parse(msg as string);
    if (data.discovery_b64) {
      this.handlePrinterConnected(socket);
    }

    if (data.channel_name === "v1.raw.zebra.com") {
      const channelId = data.unique_id;
      this.handleRawChannelOpened(channelId, socket);
    }
  }

  private handleRawChannelOpened(channelId: string, socket: WebSocket) {
    console.log(`Raw channel opened with id: ${channelId}`);
    if (this.printers[channelId])  {
      if (this.printers[channelId].deleteTimer) {
        clearTimeout(this.printers[channelId].deleteTimer);
      }
      this.printers[channelId].socket = socket;
      this.printers[channelId].connected = true;
    } else {
      this.printers[channelId] = { socket: socket, id: channelId, friendlyName: "fetching from printer...", connected: true, deleteTimer: undefined };
      socket.once("message", (data) => {
        this.printers[channelId].friendlyName = data.toString("utf-8");
      });
      socket.on("close", () => {
        if (this.printers[channelId])  {
          this.printers[channelId].connected = false;
          console.log(`Raw channel with id: ${channelId} closed`);
          this.printers[channelId].deleteTimer = setTimeout(() => {
            delete this.printers[channelId];
            console.log(`Printer with id ${channelId} deleted`);
          }, PRINTER_REMOVAL_TIMEOUT);
        }

      });
      socket.send(Buffer.from('! U1 getvar "device.friendly_name" \r\n'));
    }
  }

  private handlePrinterConnected(socket: WebSocket) {
    socket.send(Buffer.from(JSON.stringify({"open" : "v1.raw.zebra.com"})));
  }
}

const websocketApi = new WebsocketApi();
export default websocketApi;