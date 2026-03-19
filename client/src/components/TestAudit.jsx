import { useState } from "react";

const TestAudit = () => {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");

  const testAudit = async (e) => {
    e.preventDefault();
    
    //create audit
    const createRes = await fetch("http://localhost:3001/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({url}),
    });
    const response = await createRes.json();
    const audit = response.audit;

    setResult(`Created audit ${audit.id}, waiting...`);

    //poll every 2 sec until complete or timeout (max 120sec)
    let attempts = 0
    const maxAttempts = 120/2; //max seconds / 2
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); //wait 2 sec
      let getRes = await fetch(`http://localhost:3001/api/audits/${audit.id}`);
      const data = await getRes.json();
      if (data.status === "complete") {
        setResult(JSON.stringify(data, null, 2));
        return;
      } else if (data.status === "failed") {
        setResult("Audit failed!");
        return;
      }
      attempts++;
      setResult(`Checking... (${attempts * 2}s elapsed)`);
    }
    setResult(`Timeout: Audit took too long (over ${maxAttempts * 2}s)`);
  };

  return (
    <div>
      <form onSubmit={testAudit}>
        <input
          type = "text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder = "https://example.com"
        />
        <button type="submit">
          Test
        </button>
      </form>
      <pre>{result}</pre>
    </div>
  );
}

export default TestAudit;