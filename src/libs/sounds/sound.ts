export class Sound {
  private url: string
  private sound: HTMLAudioElement | null = null

  constructor(url: string) {
    this.url = url

  }

  private load() {
    this.sound = new Audio(this.url)
  }

  public play() {
    if (!this.sound) {
      this.load()
    }

    this.sound?.play()
  }
}
