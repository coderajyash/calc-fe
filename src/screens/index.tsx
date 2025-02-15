import { ColorSwatch, Group, Card } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SWATCHES } from '@/constants';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();

    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);


    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);
    
        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            });
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        };
    
        return () => {
            document.head.removeChild(script);
        };
    }, []);
    

    useEffect(() => {
        if (window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]); 

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    ctx.fillStyle = 'black'; // Set background color
                    ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill entire canvas
                }
            }
        };
    
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
    
        return () => window.removeEventListener("resize", resizeCanvas);
    }, []);

    
    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\huge{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

        // Clear the main canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };
    


    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear content
                ctx.fillStyle = 'black'; // Set background to black
                ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill entire canvas
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const { offsetX, offsetY } = getCanvasCoordinates(e);
                ctx.beginPath();
                ctx.moveTo(offsetX, offsetY);
                setIsDrawing(true);
            }
        }
    };
    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { offsetX: 0, offsetY: 0 };
    
        let offsetX: number, offsetY: number;
    
        if ("touches" in e) {
            const rect = canvas.getBoundingClientRect();
            offsetX = e.touches[0].clientX - rect.left;
            offsetY = e.touches[0].clientY - rect.top;
        } else {
            offsetX = e.nativeEvent.offsetX;
            offsetY = e.nativeEvent.offsetY;
        }
    
        return { offsetX, offsetY };
    };
    
    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const { offsetX, offsetY } = getCanvasCoordinates(e);
                ctx.strokeStyle = color;
                ctx.lineTo(offsetX, offsetY);
                ctx.stroke();
            }
        }
    };
    
    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            const response = await axios({
                method: 'post',
                url: `${import.meta.env.VITE_API_URL}/calculate`,
                data: {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars
                }
            });

            const resp = await response.data;
            console.log('Response', resp);
            resp.data.forEach((data: Response) => {
                if (data.assign === true) {
            
                    setDictOfVars({
                        ...dictOfVars,
                        [data.expr]: data.result
                    });
                }
            });
            const ctx = canvas.getContext('2d');
            const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {  // If pixel is not transparent
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result
                    });
                }, 1000);
            });
        }
    };

    return (
        <>
            <Card shadow="sm" padding="lg" className="w-full mb-4 text-white bg-black">
                <h2 className="text-lg font-bold">How to Use the Application</h2>
                <p>1. Draw a mathematical expression on the canvas using your mouse. You can also draw a and get output of the figure, eg drawing a right angled triangle with 2 sides length given it can calculate the hypotenuse</p>
                <p>2. Click "Run" to process the equation.</p>
                <p>3. The recognized LaTeX expression will appear on the screen, or the output will be presented</p>
                <p>4. Click "Reset" to clear the canvas and start over.</p>
                <div>
                <h2 className='text-sm font-bold text-gray-400'>*The Website's Backend is hosted on Render's free service. First Request may take up to 60 seconds.</h2>
            </div>
            </Card>
            

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 md:p-8 bg-black">
                <Button
                    onClick={() => setReset(true)}
                    className="z-20 bg-black text-white w-full md:w-auto bg-blue-500 hover:bg-blue-600"
                >
                    Reset
                </Button>
    
                <Group className="z-20 flex-wrap justify-center bg-gray-400 border border-gray-200 rounded-md">
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch key={swatch} color={swatch} onClick={() => setColor(swatch)} />
                    ))}
                </Group>
    
                <Button
                    onClick={runRoute}
                    className="z-20 bg-black text-white w-full md:w-auto bg-red-500 hover:bg-red-600"
                >
                    Run
                </Button>
            </div>

            <div className="relative w-full h-[calc(100vh-150px)]">
                <canvas
                    ref={canvasRef}
                    id="canvas"
                    className="w-full h-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            {latexExpression.length > 0 && (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="p-4 text-white font-bold bg-black bg-opacity-75 rounded shadow-md">
            <div className="latex-content">{latexExpression[latexExpression.length - 1]}</div>
        </div>
    </div>
)}
          
        </>
    );
    
}
