import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Textarea } from '../../../components';
import LocalStorage from '../../../database/localStorage';
import { useChatContext } from '../../../store/chat';
import { CanvasType } from '../../../types';
import { OpenInNewTab } from './OpenInNewTab';

const canInterrupt = typeof SharedArrayBuffer === 'function';

// adapted from https://pyodide.org/en/stable/usage/webworker.html
const WORKER_CODE = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");

let stdOutAndErr = [];

let pyodideReadyPromise = loadPyodide({
  stdout: (data) => stdOutAndErr.push(data),
  stderr: (data) => stdOutAndErr.push(data),
});

let alreadySetBuff = false;

self.onmessage = async (event) => {
  stdOutAndErr = [];

  // make sure loading is done
  const pyodide = await pyodideReadyPromise;
  const { id, python, context, interruptBuffer } = event.data;

  if (interruptBuffer && !alreadySetBuff) {
    pyodide.setInterruptBuffer(interruptBuffer);
    alreadySetBuff = true;
  }

  // Now load any packages we need, run the code, and send the result back.
  await pyodide.loadPackagesFromImports(python);

  // make a Python dictionary with the data from content
  const dict = pyodide.globals.get("dict");
  const globals = dict(Object.entries(context));
  try {
    self.postMessage({ id, running: true });
    // Execute the python code in this context
    const result = pyodide.runPython(python, { globals });
    self.postMessage({ result, id, stdOutAndErr });
  } catch (error) {
    self.postMessage({ error: error.message, id });
  }
  interruptBuffer[0] = 0;
};
`;

let worker: Worker;
const interruptBuffer = canInterrupt
  ? new Uint8Array(new SharedArrayBuffer(1))
  : null;

const startWorker = () => {
  if (!worker) {
    worker = new Worker(
      URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' }))
    );
  }
};

if (LocalStorage.getConfig().pyIntepreterEnabled) {
  startWorker();
}

const runCodeInWorker = (
  pyCode: string,
  callbackRunning: () => void
): {
  donePromise: Promise<string>;
  interrupt: () => void;
} => {
  startWorker();
  const id = Math.random() * 1e8;
  const context = {};
  if (interruptBuffer) {
    interruptBuffer[0] = 0;
  }

  const donePromise = new Promise<string>((resolve) => {
    worker.onmessage = (event) => {
      const { error, stdOutAndErr, running } = event.data;
      if (id !== event.data.id) return;
      if (running) {
        callbackRunning();
        return;
      } else if (error) {
        resolve(error.toString());
      } else {
        resolve(stdOutAndErr.join('\n'));
      }
    };
    worker.postMessage({ id, python: pyCode, context, interruptBuffer });
  });

  const interrupt = () => {
    console.log('Interrupting...');
    console.trace();
    if (interruptBuffer) {
      interruptBuffer[0] = 2;
    }
  };

  return { donePromise, interrupt };
};

export default function CanvasPyInterpreter() {
  const { t } = useTranslation();
  const { canvasData, setCanvasData } = useChatContext();

  const [code, setCode] = useState(canvasData?.content ?? ''); // copy to avoid direct mutation
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [interruptFn, setInterruptFn] = useState<() => void>();
  const [showStopBtn, setShowStopBtn] = useState(false);

  const runCode = async (pycode: string) => {
    interruptFn?.();
    setRunning(true);
    setOutput(t('codeRunner.canvasPyInterpreter.output.loading'));
    const { donePromise, interrupt } = runCodeInWorker(pycode, () => {
      setOutput(t('codeRunner.canvasPyInterpreter.output.running'));
      setShowStopBtn(canInterrupt);
    });
    setInterruptFn(() => interrupt);
    const out = await donePromise;
    setOutput(out);
    setRunning(false);
    setShowStopBtn(false);
  };

  // run code on mount
  useEffect(() => {
    setCode(canvasData?.content ?? '');
    runCode(canvasData?.content ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasData?.content]);

  if (canvasData?.type !== CanvasType.PY_INTERPRETER) {
    return null;
  }

  return (
    <div className="card bg-base-300 w-full h-full shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-bold">
            {t('codeRunner.canvasPyInterpreter.title')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            title={t('codeRunner.buttons.close')}
            onClick={() => setCanvasData(null)}
          >
            <Icon icon="LuX" size="md" />
          </Button>
        </div>
        <div className="grid grid-rows-3 gap-4 h-full">
          <Textarea
            className="h-full font-mono"
            size="full"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex flex-col row-span-2">
            <div className="flex items-center mb-2">
              <Button
                size="small"
                title={t('codeRunner.buttons.run')}
                onClick={() => runCode(code)}
                disabled={running}
              >
                <Icon icon="LuPlay" variant="leftside" size="md" />
                {t('codeRunner.buttons.run')}
              </Button>
              {showStopBtn && (
                <Button
                  size="small"
                  className="bg-base-100 ml-2"
                  title={t('codeRunner.buttons.stop')}
                  onClick={() => interruptFn?.()}
                >
                  <Icon icon="LuSquare" variant="leftside" size="md" />
                  {t('codeRunner.buttons.stop')}
                </Button>
              )}
              <span className="grow text-right text-xs">
                <OpenInNewTab href="https://github.com/ggerganov/llama.cpp/issues/11762">
                  {t('codeRunner.links.reportBug')}
                </OpenInNewTab>
              </span>
            </div>
            <Textarea
              className="h-full font-mono dark-color"
              size="full"
              value={output}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}
