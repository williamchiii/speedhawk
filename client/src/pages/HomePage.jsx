import TestAudit from "../components/TestAudit.jsx";

const HomePage = () => {
  return (
    <div>
        <h1>HomePage</h1>
        <a href="http://localhost:5173/health">Check Client/Server Connection Health</a>
        <TestAudit/>
    </div>
  )
}

export default HomePage