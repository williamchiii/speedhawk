import axios from "axios";
import { useState } from "react";

const TestAudit = () => {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");

  const testAudit = async (e) => {
    e.preventDefault();

    //create audit (with axios)
    const createRes = await axios.post("http://localhost:3001/api/audits", {url});
    const audit = createRes.data.audit;

    setResult(`Created audit ${audit.id}, waiting...`);

    //poll every 2 sec until complete or timeout (max 120sec)
    let attempts = 0
    const maxAttempts = 120/2; //max seconds / 2
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); //wait 2 sec

      const getRes = await axios.get(`http://localhost:3001/api/audits/${audit.id}`);
      const data = getRes.data;

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
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <form className="input input-bordered h-15 w-full max-w-xl self-center" onSubmit={testAudit}>
        <input
          type = "text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder = "https://example.com"
        />
        <button className="btn btn-primary"type="submit">
          Test
        </button>
      </form>
      {result && (
        <pre className="bg-base-200 rounded-lg p-4 text-sm overflow-auto max-h-[70vh] w-full">{result}</pre>
      )}
    </div>
  );
}

export default TestAudit;