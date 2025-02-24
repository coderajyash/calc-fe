import { ColorSwatch, Group, Card } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SWATCHES } from '@/constants';

const BACKGROUND_COLOR = 'rgb(0, 0, 0)';

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
    const [isLoading, setIsLoading] = useState(false);
    const [isErasing, setIsErasing] = useState(false);

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
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
        };
    
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
    
        return () => window.removeEventListener("resize", resizeCanvas);
    }, []);

    const renderLatexToCanvas = (_: string, answer: string) => {
        const latex = `\\(\\huge{${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

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
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
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
                ctx.lineWidth = isErasing ? 20 : 5;
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
                ctx.strokeStyle = isErasing ? BACKGROUND_COLOR : color;
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
            setIsLoading(true);
            try {
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
                        if (imageData.data[i + 3] > 0) {
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
                            expression: '',
                            answer: data.result
                        });
                    }, 1000);
                });
            } catch (error) {
                console.error('Error during request:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const toggleEraser = () => {
        setIsErasing(!isErasing);
        if (isErasing) setColor('rgb(255, 255, 255)');
    };

    return (
        <>
            <Card shadow="sm" className="w-full mb-4 text-white bg-black p-4">
                <h2 className="text-md font-bold">How to Use the Application</h2>
                <p>Draw a mathematical expression on the canvas. You can also draw a and get output of the figure, eg drawing a right angled triangle with 2 sides length given it can calculate the hypotenuse. Get values of x and y given the equation and more.</p>
                <div>
                    <h2 className='text-sm font-bold text-gray-400'>First Request may take up to 60 seconds or more.</h2>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 p-4 md:p-8 bg-black gap-1">
                <Button
                    onClick={() => setReset(true)}
                    className="z-20 bg-black text-white w-full md:w-auto bg-blue-500 hover:bg-blue-600"
                >
                    Reset
                </Button>
    
                <Group className="z-20 flex-wrap justify-center bg-gray-400 border border-gray-200 rounded-md">
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch 
                            key={swatch} 
                            color={swatch} 
                            onClick={() => {
                                setIsErasing(false);
                                setColor(swatch);
                            }} 
                        />
                    ))}
                </Group>

                <Button
                    onClick={toggleEraser}
                    className={`z-20 w-full md:w-auto ${isErasing 
                        ? 'bg-yellow-500 hover:bg-yellow-600' 
                        : 'bg-gray-500 hover:bg-gray-600'} text-white`}
                >
                    {isErasing ? 'Draw' : 'Erase'}
                </Button>
    
                <Button
                    onClick={runRoute}
                    className="z-20 bg-black text-white w-full md:w-auto bg-red-500 hover:bg-red-600"
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : 'Run'}
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
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                        <div className="text-white text-2xl font-bold">Loading...</div>
                    </div>
                )}
            </div>

            {latexExpression.length > 0 && (
                <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none h-screen">
                    <div className="p-4 sm:p-3 md:p-4 text-black font-bold bg-white rounded w-1/4 pd-4 text-center overflow-x-auto overflow-y-auto">
                        <div className="latex-content break-words whitespace-pre-wrap text-xs sm:text-md md:text-base lg:text-lg">
                            {latexExpression[latexExpression.length - 1]}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}