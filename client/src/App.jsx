import { Route, Routes } from 'react-router';
import HealthPage from './pages/HealthPage.jsx';
import HomePage from './pages/HomePage.jsx';

const App = () => {
  return (
    <div>
      <Routes>
        <Route path = "/" element = {<HomePage/>}/>
        <Route path = "/health" element = {<HealthPage/>}/>
      </Routes>
    </div>
  )
}

export default App;