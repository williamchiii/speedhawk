//this page checks the health of the API
import axios from "axios";
import { useEffect, useState } from 'react';
import { apiUrl } from "../utils/apiURL.js";

const HealthPage = () => {
    const [message, setMessage] = useState("Checking backend...");

    useEffect(() => {
        axios
            .get(apiUrl("/health"))
            .then(({ data }) => {
                setMessage(`Backend status: ${data.status} (${data.service})`);
            })
            .catch(() => {
                setMessage("Failed to connect to backend");
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
