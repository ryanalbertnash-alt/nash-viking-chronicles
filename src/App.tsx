import { Component, type ReactNode } from "react"
import { Gates } from "@/Gates"
import { Play } from "@/Play"
import { useSession } from "@/session"

export function App() {
  const { phase, you, world } = useSession()
  return (
    <Boundary>
      {phase === "play" && you && world ? <Play /> : <Gates />}
    </Boundary>
  )
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) { return { error: err.message } }
  render() {
    if (this.state.error) {
      return (
        <main className="gate">
          <div className="gate-copy">
            <p className="eyebrow">The saga stumbled</p>
            <h1>Hold the line</h1>
            <p className="lede">{this.state.error}</p>
            <button className="voice" onClick={() => location.reload()}><b>Reload</b></button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
