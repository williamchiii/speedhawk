import Audit from "../components/Audit.jsx";
import Navbar from "../components/Navbar.jsx";
import DottedSurface from "../components/DottedSurface/DottedSurface.jsx";

const HomePage = () => {
  return (
    <div className="relative overflow-hidden">
      <DottedSurface/>
      <div className="relative z-10">
        <Navbar />
        <div className="divider -mt-1"/>
      </div>
      <div className="relative z-10 min-h-screen flex flex-col items-center gap-8 pt-16 px-4">
        <div className="text-6xl font-bold">SpeedHawk Audit</div>
        <Audit/>
      </div>
    </div>
  );
}

export default HomePage
