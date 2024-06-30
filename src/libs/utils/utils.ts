export class Utils {
  private readonly antropyFator = 3

  public getUniqId(): number {
    const array = new Uint32Array(this.antropyFator)
    crypto.getRandomValues(array)
    return array[Math.floor(Math.random() * this.antropyFator)]
  }
}

const utils = new Utils()
export default utils
