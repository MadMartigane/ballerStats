import { AuthType, createClient, WebDAVClient } from 'webdav'

export class WebDAV {
  private client: WebDAVClient

  constructor() {
    this.client = this.createClient()
  }

  private connect() {
    if (!this.client) {
      this.client = createClient(
        'https://drive.shadow.tech/remote.php/webdav',
        {
          authType: AuthType.Digest,
          username: 'mad.martigane-7331',
          password: 'jzKH2bf8tFzp3LC9k388oHw3',
        },
      )
    }
  }

  public createClient() {
    this.connect()
    console.log('[WebDAV] client: ', this.client)
    return this.client
  }
  /*
createClient(
  "https://drive.shadow.tech/remote.php/webdav",
    {
        authType: AuthType.Token,
        token: {
            access_token: "2YotnFZFEjr1zCsicMWpAA",
            token_type: "example",
            refresh_token: "tGzv3JOkF0XG5Qx2TlKWIA",
        }
    }
);
*/

  public async getDirectoryContents() {
    this.connect()

    const directoryItems = await this.client.getDirectoryContents('/')
    console.log('[WebDAV] directoryItems: ', directoryItems)
    return directoryItems
  }
}

const webDAV = new WebDAV()
export default webDAV
