//this page checks the health of the API
import { useEffect, useState } from 'react';

const HealthPage = () => {
    const [message, setMessage] = useState("Checking backend...");

    useEffect(() => {
        fetch("http://localhost:3001/health") //hard coded url/port, change later on
        .then((res) => res.json())
        .then((data) => {
            setMessage(`Backend status: ${data.status} (${data.service})`);
        })
        .catch(() => {
            setMessage("Failed to connect to backend");
        });
    }, []);

    return (
      <div>
        <h1>Speedhawk</h1>
        <p>{message}</p>
      </div>
    );
}

export default HealthPage