//this page checks the health of the API
import axios from "axios";
import { useEffect, useState } from 'react';

const HealthPage = () => {
    const [message, setMessage] = useState("Checking backend...");

    useEffect(() => {
        axios
            .get("http://localhost:3001/health")
            .then(response => {
                setMessage(JSON.stringify(response.data));
            })
            .catch(() => {
                setMessage("Failed to connect to server");
            })
    }, []);

    return (
      <div>
        <h1>Speedhawk</h1>
        <p>{message}</p>
      </div>
    );
}

export default HealthPage