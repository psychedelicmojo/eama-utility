import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Files, X } from 'lucide-react';
import { MBOXParser, ParseResult, ParsedEmail } from './services/MBOXParser';

function App() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [workingSet, setWorkingSet] = useState<ParsedEmail[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setParseResult(null);
    setSelectedEmails([]);
    setWorkingSet([]);

    try {
      const content = await file.text();
      const parser = new MBOXParser();
      const result = parser.parse(content);
      setParseResult(result);
    } catch (err) {
      setError(`Failed to parse MBOX file: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEmail = (uid: string) => {
    setExpandedEmail(expandedEmail === uid ? null : uid);
  };

  const handleSelectEmail = (uid: string) => {
    setSelectedEmails(prevSelected =>
      prevSelected.includes(uid)
        ? prevSelected.filter(id => id !== uid)
        : [...prevSelected, uid]
    );
  };

  const addToWorkingSet = () => {
    if (!parseResult) return;
    const emailsToAdd = parseResult.emails.filter(email => selectedEmails.includes(email.uid));
    const newWorkingSet = [...workingSet];
    emailsToAdd.forEach(email => {
        if (!newWorkingSet.find(wsEmail => wsEmail.uid === email.uid)) {
            newWorkingSet.push(email);
        }
    });
    setWorkingSet(newWorkingSet);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            EAMA - Email Analysis Utility
          </h1>
          <p className="text-sm text-gray-600">
            MBOX Parser Demo - Upload and analyze email archives
          </p>
        </header>

        <div className="mb-6">
          <label className="inline-block">
            <input
              type="file"
              accept=".mbox,.txt"
              onChange={handleFileUpload}
              disabled={isLoading}
              className="hidden"
            />
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors text-sm">
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Parsing...' : 'Upload MBOX File'}</span>
            </div>
          </label>
        </div>

        {isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Parsing MBOX file...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900">Parse Error</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {parseResult && (
          <>
             {workingSet.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <Files className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-indigo-900">Working Set ({workingSet.length})</h3>
                        </div>
                        <button onClick={() => setWorkingSet([])} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                            <X className="w-4 h-4"/>
                            Clear
                        </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {workingSet.map(email => (
                            <div key={email.uid} className="text-sm text-indigo-800 p-2 bg-indigo-100 rounded">
                                <p className="font-medium truncate">{email.metadata.subject}</p>
                                <p className="text-xs">From: {email.metadata.from.join(', ')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Parse Complete</h3>
                  <p className="text-green-700 text-sm">
                    Successfully parsed {parseResult.stats.totalEmails} emails in{' '}
                    {parseResult.stats.parseTime.toFixed(2)}ms
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-3xl font-bold text-gray-900">
                  {parseResult.stats.totalEmails}
                </div>
                <div className="text-sm text-gray-600">Total Emails</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-3xl font-bold text-gray-900">
                  {formatBytes(parseResult.stats.totalBytes)}
                </div>
                <div className="text-sm text-gray-600">Total Size</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-3xl font-bold text-gray-900">
                  {parseResult.stats.parseTime.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">Parse Time</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-3xl font-bold text-gray-900">
                  {formatBytes(parseResult.stats.avgEmailSize)}
                </div>
                <div className="text-sm text-gray-600">Avg Size</div>
              </div>
            </div>

            {parseResult.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  Parse Warnings ({parseResult.errors.length})
                </h3>
                <div className="space-y-1">
                  {parseResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-sm text-yellow-800">
                      {err.type}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gray-100 px-6 py-3 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Parsed Emails</h3>
                    {selectedEmails.length > 0 && (
                        <div className="flex items-center gap-2">
                             <button onClick={() => setSelectedEmails([])} className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                                Clear Selection ({selectedEmails.length})
                            </button>
                            <button onClick={addToWorkingSet} className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                                Add to Working Set
                            </button>
                        </div>
                    )}
                </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {parseResult.emails.map((email, idx) => (
                  <div key={email.uid} className={`hover:bg-gray-50 ${selectedEmails.includes(email.uid) ? 'bg-blue-50' : ''}`}>
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleEmail(email.uid)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            className="mt-1.5"
                            checked={selectedEmails.includes(email.uid)}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleSelectEmail(email.uid);
                            }}
                        />
                        <div className="mt-1">
                          {expandedEmail === email.uid ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="font-medium text-gray-900 truncate">
                              {email.metadata.subject}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">From:</span> {email.metadata.from.join(', ')}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">To:</span> {email.metadata.to.join(', ')}
                          </div>
                          {email.metadata.date && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(email.metadata.date).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatBytes(email.rawSize)}
                        </div>
                      </div>
                    </div>

                    {expandedEmail === email.uid && (
                      <div className="px-4 pb-4 bg-gray-50">
                        <div className="border-t pt-4 space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Headers ({Object.keys(email.headers).length})
                            </h4>
                            <div className="bg-white rounded border p-3 max-h-48 overflow-y-auto">
                              <table className="w-full text-sm">
                                <tbody>
                                  {Object.entries(email.headers).map(([key, values]) => (
                                    <tr key={key} className="border-b last:border-b-0">
                                      <td className="py-1 pr-4 font-medium text-gray-700 align-top">
                                        {key}:
                                      </td>
                                      <td className="py-1 text-gray-600">
                                        {values.map((val, i) => (
                                          <div key={i}>{val}</div>
                                        ))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Body
                            </h4>
                            <div className="bg-white rounded border p-3 max-h-64 overflow-y-auto">
                              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                {email.body.text}
                              </pre>
                            </div>
                          </div>

                          {email.metadata.references && email.metadata.references.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                Thread References
                              </h4>
                              <div className="bg-white rounded border p-3">
                                {email.metadata.references.map((ref, i) => (
                                  <div key={i} className="text-xs text-gray-600 font-mono">
                                    {ref}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;