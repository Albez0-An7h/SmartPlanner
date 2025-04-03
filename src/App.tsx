import CalendarData from "./CalanderData"
import PlanGenerate from "./PlanGenerate"
import Footer from "./Footer"

function App() {
  return (
    <div className="bg-[#9ACBD0] bg-opacity-20 min-h-screen">
      <CalendarData/>
      <PlanGenerate/>
      <Footer/>
    </div>
  )
}

export default App
