import express from 'express';
import websocketApi from "../websocket";
import bodyParser from "body-parser";

const API_BASE_PATH = "/rest/v1"

class Api {

  private app = express();

  constructor() {
    this.app.use(bodyParser.urlencoded({ extended: false }))
    this.app.use(bodyParser.json());
    this.app.get(`${API_BASE_PATH}/printers`, this.getListPrinters);
    this.app.post(`${API_BASE_PATH}/printers/:printerId/raw`, this.postRawPrinterCommand);
  }

  /**
   * Starts listening
   * 
   * @param port port to listen to
   */
  listen(port: number) {
    this.app.listen(port, err => {
      if (err) {
        throw err;
      }
      console.log(`Api listening on port: ${port}`);
    });
  }

  /**
   * Handles list printers GET request
   * 
   * @param req http request
   * @param res http response
   */
  private getListPrinters(req: express.Request, res: express.Response) {
    res.send(websocketApi.getConnectedPrinters());
  }

  /**
   * Handles POST command request
   * 
   * @param req http request
   * @param res http response
   */
  private postRawPrinterCommand(req: express.Request, res: express.Response) {
    const printerId = req.params.printerId;
    const command = req.body.command;
    if (!printerId) {
      return res.status(400).send("Missing printerId");
    }

    if (!command) {
      return res.status(400).send("Missing command");
    }

    const found = websocketApi.sendCommand(printerId, command);
    if (!found) {
      return res.status(404).send("Printer not found");
    }

    res.status(204).send();
  }
}

const api = new Api();

export default api;