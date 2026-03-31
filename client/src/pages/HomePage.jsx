import TestAudit from "../components/TestAudit.jsx";
import Navbar from "../components/Navbar.jsx";

const HomePage = () => {
  return (
    <div>
      <Navbar />
      <div className="divider -mt-1"/>
      <div className="min-h-screen flex flex-col items-center gap-8 pt-16 px-4">
        <div className="text-7xl">Analyze a Website</div>
        <TestAudit/>
      </div>
    </div>
  );
}

export default HomePage
