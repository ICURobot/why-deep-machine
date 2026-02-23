import { useMemo, useState } from 'react';

const QUESTION_COUNT = 5;

const buildPrompt = (problem, answers) => {
  const chain = answers
    .map((answer, idx) => `${idx + 1}. Why? ${answer}`)
    .join('\n');

  return `You are an expert root cause analyst using the 5 Whys method.\n\nProblem statement:\n${problem}\n\n5 Whys answers:\n${chain}\n\nReturn strict JSON in this shape:\n{\n  "rootCause": "single concise sentence",\n  "confidence": "Low|Medium|High",\n  "insights": ["insight 1", "insight 2", "insight 3"],\n  "solutions": [\n    {"title": "solution name", "whyItWorks": "one sentence", "firstStep": "one practical first step"},\n    {"title": "solution name", "whyItWorks": "one sentence", "firstStep": "one practical first step"},\n    {"title": "solution name", "whyItWorks": "one sentence", "firstStep": "one practical first step"}\n  ]\n}`;
};

const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not parse model output as JSON');
  }
};

export default function App() {
  const [problem, setProblem] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [answers, setAnswers] = useState([]);
  const [draft, setDraft] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const activeQuestion = answers.length + 1;
  const isComplete = answers.length === QUESTION_COUNT;

  const prompt = useMemo(() => buildPrompt(problem, answers), [problem, answers]);

  const handleSubmitAnswer = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setAnswers((prev) => [...prev, draft.trim()]);
    setDraft('');
  };

  const handleReset = () => {
    setAnswers([]);
    setDraft('');
    setAnalysis(null);
    setError('');
  };

  const runAnalysis = async () => {
    if (!apiKey.trim()) {
      setError('Enter a Gemini API key to generate findings.');
      return;
    }

    setError('');
    setAnalyzing(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed (${response.status})`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No content returned from Gemini.');

      const parsed = safeParse(text);
      setAnalysis(parsed);
    } catch (err) {
      setError(err.message || 'Failed to analyze answers.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="card">
        <header>
          <p className="eyebrow">Focused Root Cause Analysis</p>
          <h1>5 Whys Explorer</h1>
          <p className="intro">Move through one why at a time, then let Gemini synthesize your root cause and next actions.</p>
        </header>

        <section className="setup-grid">
          <label>
            Problem statement
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What problem are you trying to solve?"
              rows={3}
            />
          </label>

          <label>
            Gemini API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
            />
          </label>
        </section>

        <section className="questions">
          {answers.map((answer, idx) => (
            <article className="question collapsed" key={`answered-${idx}`}>
              <h3>Why #{idx + 1}</h3>
              <p>{answer}</p>
            </article>
          ))}

          {!isComplete && (
            <article className="question active">
              <h3>Why #{activeQuestion}</h3>
              <form onSubmit={handleSubmitAnswer}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your answer and submit to continue..."
                  rows={4}
                  required
                />
                <button type="submit" disabled={!problem.trim()}>
                  Submit why #{activeQuestion}
                </button>
              </form>
              {!problem.trim() && <small>Add a problem statement to begin.</small>}
            </article>
          )}
        </section>

        {isComplete && (
          <section className="actions">
            <button onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? 'Analyzing with Gemini…' : 'Identify root cause + solutions'}
            </button>
            <button className="ghost" onClick={handleReset}>Start over</button>
          </section>
        )}

        {error && <p className="error">{error}</p>}

        {analysis && (
          <section className="results">
            <div className="hero-result">
              <h2>Likely Root Cause</h2>
              <p>{analysis.rootCause}</p>
              <span className="pill">Confidence: {analysis.confidence || 'N/A'}</span>
            </div>

            <div>
              <h3>Key Insights</h3>
              <ul>
                {(analysis.insights || []).map((insight, idx) => (
                  <li key={`insight-${idx}`}>{insight}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3>Recommended Solutions</h3>
              <div className="solution-grid">
                {(analysis.solutions || []).map((solution, idx) => (
                  <article key={`sol-${idx}`} className="solution-card">
                    <h4>{solution.title}</h4>
                    <p>{solution.whyItWorks}</p>
                    <strong>First step:</strong>
                    <p>{solution.firstStep}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
