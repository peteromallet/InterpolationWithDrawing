'use client'

import React, { useState, useRef, useEffect, useReducer, useCallback } from 'https://cdn.skypack.dev/react@19.0.0';
import { Card } from './ui/card.js';
import { Button } from './ui/button.js';
import { Slider } from './ui/slider.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Eraser, ImagePlus, X, Loader2 } from 'https://cdn.skypack.dev/lucide-react@0.468.0';
import { cn } from '../lib/utils.js';
import Modal from './ui/modal.js';

// Canvas dimensions
const CANVAS_DIMENSIONS = {
  WIDTH: 600,
  HEIGHT: 400
} as const;

// Interaction constants
const INTERACTION = {
  DRAG_INFLUENCE_RADIUS: 100,
  POINT_SELECTION_RADIUS: 15,
  MARKER_SIZES: {
    INNER_CIRCLE: 8,
    OUTER_CIRCLE: 12
  }
} as const;

// Drawing styles
const DRAWING_STYLES = {
  LINE: {
    COLOR: '#ff0000',
    WIDTH: 2,
    CAP: 'round' as CanvasLineCap
  },
  MARKER: {
    FILL: {
      PRIMARY: 'rgba(0, 255, 0, 0.5)',
      SECONDARY: 'rgba(0, 255, 0, 0.2)'
    }
  }
} as const;

// Default values
const DEFAULTS = {
  NUM_POINTS: 75,
  SLIDER_MAX: 100,
  SLIDER_STEP: 1,
  MIN_FRAMES: 49,
  MAX_FRAMES: 101
} as const;

// Custom hook for canvas operations
const useCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  state: TrajectoryState,
  dispatch: React.Dispatch<TrajectoryAction>
) => {
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const image1Ref = useRef<HTMLImageElement | null>(null);
  const image2Ref = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Helper function for consistent error handling
  const handleError = (error: Error, recoveryCallback?: () => void) => {
    console.error(error);
    dispatch({ type: 'SET_ERROR', error: error.message });
    if (recoveryCallback) recoveryCallback();
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_DIMENSIONS.WIDTH;
    canvas.height = CANVAS_DIMENSIONS.HEIGHT;

    const context = canvas.getContext('2d');
    if (context) {
      context.strokeStyle = DRAWING_STYLES.LINE.COLOR;
      context.lineWidth = DRAWING_STYLES.LINE.WIDTH;
      context.lineCap = DRAWING_STYLES.LINE.CAP;
      contextRef.current = context;
      drawCanvas();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update useEffect for image loading to handle null images
  useEffect(() => {
    // Clear existing image refs if no images present
    if (!state.images.images[1]) {
      if (image1Ref.current) {
        image1Ref.current = null;
        drawCanvas();
      }
    }
    if (!state.images.images[2]) {
      if (image2Ref.current) {
        image2Ref.current = null;
        drawCanvas();
      }
    }

    // Load new images if they exist
    if (state.images.images[1]) {
      const img1 = new Image();
      img1.src = URL.createObjectURL(state.images.images[1]);
      img1.onload = () => {
        image1Ref.current = img1;
        drawCanvas();
      };
      img1.onerror = () => {
        handleError(new Error('Failed to load starting image'), () => handleRemoveImage(1));
      };
    }
    if (state.images.images[2]) {
      const img2 = new Image();
      img2.src = URL.createObjectURL(state.images.images[2]);
      img2.onload = () => {
        image2Ref.current = img2;
        drawCanvas();
      };
      img2.onerror = () => {
        handleError(new Error('Failed to load ending image'), () => handleRemoveImage(2));
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.images.images]);

  // Draw canvas whenever dependencies change
  useEffect(() => {
    drawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.images.images, state.drawing.anchorPoints, state.transition.transitionProgress, state.drawing.currentDrawPoints]);

  const drawCanvas = () => {
    const context = contextRef.current;
    const canvas = canvasRef.current;

    if (!context || !canvas) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (image1Ref.current) {
      context.globalAlpha = 1 - state.transition.transitionProgress;
      context.drawImage(image1Ref.current, 0, 0, canvas.width, canvas.height);
    }

    if (image2Ref.current) {
      context.globalAlpha = state.transition.transitionProgress;
      context.drawImage(image2Ref.current, 0, 0, canvas.width, canvas.height);
    }

    context.globalAlpha = 1;

    if (state.drawing.anchorPoints.length > 1) {
      context.beginPath();
      context.moveTo(state.drawing.anchorPoints[0].x, state.drawing.anchorPoints[0].y);
      for (let i = 1; i < state.drawing.anchorPoints.length; i++) {
        context.lineTo(state.drawing.anchorPoints[i].x, state.drawing.anchorPoints[i].y);
      }
      context.strokeStyle = DRAWING_STYLES.LINE.COLOR;
      context.lineWidth = DRAWING_STYLES.LINE.WIDTH;
      context.stroke();

      const currentIndex = Math.min(
        Math.floor(state.transition.transitionProgress * (state.drawing.anchorPoints.length - 1)),
        state.drawing.anchorPoints.length - 1
      );
      const currentPoint = state.drawing.anchorPoints[currentIndex];

      context.beginPath();
      context.arc(currentPoint.x, currentPoint.y, INTERACTION.MARKER_SIZES.INNER_CIRCLE, 0, 2 * Math.PI);
      context.fillStyle = DRAWING_STYLES.MARKER.FILL.PRIMARY;
      context.fill();

      context.beginPath();
      context.arc(currentPoint.x, currentPoint.y, INTERACTION.MARKER_SIZES.OUTER_CIRCLE, 0, 2 * Math.PI);
      context.fillStyle = DRAWING_STYLES.MARKER.FILL.SECONDARY;
      context.fill();
    }

    if (state.drawing.currentDrawPoints.length > 1) {
      context.beginPath();
      context.moveTo(state.drawing.currentDrawPoints[0].x, state.drawing.currentDrawPoints[0].y);
      state.drawing.currentDrawPoints.forEach((point, index) => {
        if (index > 0) {
          context.lineTo(point.x, point.y);
        }
      });
      context.stroke();
    }
  };
};

// Add these type definitions at the top of the file
type Point = { x: number; y: number };
type InteractionMode = 'idle' | 'drawing' | 'draggingPoint' | 'draggingLine';
type TutorialStep = 'upload' | 'draw' | 'review' | 'generate' | 'none';

// Updated ImageState to include imageURLs
interface ImageState {
  images: { [key: number]: File | null };
  imageURLs: { [key: number]: string | null };
}

// Break down state into logical pieces
interface DrawingState {
  interactionMode: InteractionMode;
  selectedPointIndex: number | null;
  numPoints: number;
  anchorPoints: Point[];
  currentDrawPoints: Point[];
  dragStart: Point;
  lastMousePosition: Point | null;
}

interface TransitionState {
  transitionProgress: number;
  hasUsedSlider: boolean;
}

interface UIState {
  error: string | null;
  tutorialStep: TutorialStep;
  motionPrompt: string;
  isGenerating: boolean;
}

// Combined state interface updated
interface TrajectoryState {
  images: ImageState;
  drawing: DrawingState;
  transition: TransitionState;
  ui: UIState;
}

// Update action types to match new state structure
type TrajectoryAction =
  | { type: 'SET_MODE'; mode: InteractionMode }
  | { type: 'SET_SELECTED_POINT'; index: number | null }
  | { type: 'SET_NUM_POINTS'; count: number }
  | { type: 'SET_ANCHOR_POINTS'; points: Point[] }
  | { type: 'SET_CURRENT_DRAW_POINTS'; points: Point[] }
  | { type: 'ADD_DRAW_POINT'; point: Point }
  | { type: 'SET_TRANSITION_PROGRESS'; progress: number }
  | { type: 'SET_IMAGE'; imageNumber: 1 | 2; file: File | null }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_LAST_MOUSE_POSITION'; position: Point | null }
  | { type: 'SET_HAS_USED_SLIDER'; value: boolean }
  | { type: 'SET_TUTORIAL_STEP'; step: TutorialStep }
  | { type: 'SET_MOTION_PROMPT'; prompt: string }
  | { type: 'RESET_TRAJECTORY' }
  | { type: 'SET_GENERATING'; isGenerating: boolean };

// Update reducer to handle new state structure
const trajectoryReducer = (state: TrajectoryState, action: TrajectoryAction): TrajectoryState => {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        drawing: { ...state.drawing, interactionMode: action.mode }
      };
    case 'SET_SELECTED_POINT':
      return {
        ...state,
        drawing: { ...state.drawing, selectedPointIndex: action.index }
      };
    case 'SET_NUM_POINTS':
      return {
        ...state,
        drawing: { ...state.drawing, numPoints: action.count }
      };
    case 'SET_ANCHOR_POINTS':
      return {
        ...state,
        drawing: { ...state.drawing, anchorPoints: action.points }
      };
    case 'SET_CURRENT_DRAW_POINTS':
      return {
        ...state,
        drawing: { ...state.drawing, currentDrawPoints: action.points }
      };
    case 'ADD_DRAW_POINT':
      return {
        ...state,
        drawing: {
          ...state.drawing,
          currentDrawPoints: [...state.drawing.currentDrawPoints, action.point]
        }
      };
    case 'SET_TRANSITION_PROGRESS':
      return {
        ...state,
        transition: { ...state.transition, transitionProgress: action.progress }
      };
    case 'SET_IMAGE': {
      // Revoke the old object URL if it exists
      if (state.images.imageURLs[action.imageNumber]) {
        URL.revokeObjectURL(state.images.imageURLs[action.imageNumber]!);
      }

      // Create a new object URL if a new file is provided
      const newURL = action.file ? URL.createObjectURL(action.file) : null;

      const newImages = {
        ...state.images.images,
        [action.imageNumber]: action.file,
      };

      const newImageURLs = {
        ...state.images.imageURLs,
        [action.imageNumber]: newURL,
      };

      return {
        ...state,
        images: {
          images: newImages,
          imageURLs: newImageURLs,
        },
        ui: {
          ...state.ui,
          tutorialStep: newImages[1] && newImages[2] ? 'draw' : 'upload',
          error: null, // Clear any existing error
        },
      };
    }
    case 'SET_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: action.error }
      };
    case 'SET_LAST_MOUSE_POSITION':
      return {
        ...state,
        drawing: { ...state.drawing, lastMousePosition: action.position }
      };
    case 'SET_HAS_USED_SLIDER':
      return {
        ...state,
        transition: { ...state.transition, hasUsedSlider: action.value }
      };
    case 'SET_TUTORIAL_STEP':
      return {
        ...state,
        ui: { ...state.ui, tutorialStep: action.step }
      };
    case 'SET_MOTION_PROMPT':
      return {
        ...state,
        ui: { ...state.ui, motionPrompt: action.prompt }
      };
    case 'RESET_TRAJECTORY':
      // Revoke all object URLs on reset
      Object.values(state.images.imageURLs).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      return {
        ...state,
        images: {
          images: { 1: null, 2: null },
          imageURLs: { 1: null, 2: null },
        },
        drawing: {
          ...state.drawing,
          anchorPoints: [],
          currentDrawPoints: [],
          interactionMode: 'idle',
          selectedPointIndex: null,
        },
        transition: {
          ...state.transition,
          transitionProgress: 0
        },
        ui: {
          ...state.ui,
          error: null,
          tutorialStep: 'upload'
        }
      };
    case 'SET_GENERATING':
      return {
        ...state,
        ui: { ...state.ui, isGenerating: action.isGenerating }
      };
    default:
      return state;
  }
};

const styles = {
  overlay: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
  modal: "bg-white rounded-lg p-6 max-w-md w-full mx-4 relative",
  title: "text-lg font-semibold mb-4",
  content: "flex flex-col items-center justify-center space-y-4"
};

const Modal = ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => {
  if (!isOpen) return null;
  
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {children}
      </div>
    </div>
  );
};

const TrajectoryDrawer = () => {
  const initialState: TrajectoryState = {
    images: {
      images: { 1: null, 2: null },
      imageURLs: { 1: null, 2: null },
    },
    drawing: {
      interactionMode: 'idle',
      selectedPointIndex: null,
      numPoints: DEFAULTS.NUM_POINTS,
      anchorPoints: [],
      currentDrawPoints: [],
      dragStart: { x: 0, y: 0 },
      lastMousePosition: null
    },
    transition: {
      transitionProgress: 0,
      hasUsedSlider: false
    },
    ui: {
      error: null,
      tutorialStep: 'upload',
      motionPrompt: '',
      isGenerating: false,
    }
  };

  const [state, dispatch] = useReducer(trajectoryReducer, initialState);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleRemoveImage = useCallback((imageNumber: number) => {
    // First dispatch the image removal
    dispatch({ type: 'SET_IMAGE', imageNumber: imageNumber as 1 | 2, file: null });
    
    // Then reset the trajectory if both images are gone
    const otherImageNumber = imageNumber === 1 ? 2 : 1;
    if (!state.images.images[otherImageNumber]) {
      dispatch({ type: 'RESET_TRAJECTORY' });
    }
  }, [state.images.images]);

  // Now we can use handleRemoveImage in useCanvas
  useCanvas(canvasRef, state, dispatch);

  const interpolatePoints = (points: { x: number; y: number }[], numPoints: number) => {
    if (points.length < 2) return points;

    const result: { x: number; y: number }[] = [];
    const totalLength = points.reduce((acc, point, i) => {
      if (i === 0) return acc;
      const prev = points[i - 1];
      return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
    }, 0);

    const segmentLengths = points.slice(1).map((point, i) => {
      const prev = points[i];
      return Math.hypot(point.x - prev.x, point.y - prev.y);
    });

    for (let i = 0; i < numPoints; i++) {
      const targetLength = (i / (numPoints - 1)) * totalLength;
      let accumulatedLength = 0;
      let segmentIndex = 0;

      while (segmentIndex < segmentLengths.length && accumulatedLength + segmentLengths[segmentIndex] < targetLength) {
        accumulatedLength += segmentLengths[segmentIndex];
        segmentIndex++;
      }

      if (segmentIndex >= segmentLengths.length) {
        // If targetLength exceeds totalLength due to floating point, use last point
        result.push({ ...points[points.length - 1] });
        continue;
      }

      const remainingLength = targetLength - accumulatedLength;
      const ratio = remainingLength / segmentLengths[segmentIndex];
      const startPoint = points[segmentIndex];
      const endPoint = points[segmentIndex + 1];

      result.push({
        x: startPoint.x + (endPoint.x - startPoint.x) * ratio,
        y: startPoint.y + (endPoint.y - startPoint.y) * ratio
      });
    }

    return result;
  };

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, imageNumber: 1 | 2) => {
      const file = e.target.files?.[0];
      if (file) {
        console.log(`Uploading image ${imageNumber}:`, {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        // Dispatch the SET_IMAGE action
        dispatch({
          type: 'SET_IMAGE',
          imageNumber,
          file,
        });
      }
    },
    []
  );

  const startInteraction = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      try {
        const { offsetX, offsetY } = e.nativeEvent;
        
        console.log('=== Starting Interaction ===');
        const image1 = state.images.images[1];
        const image2 = state.images.images[2];
        console.log('Current State:', {
          image1Details: image1 ? {
            name: image1.name,
            type: image1.type,
            size: image1.size
          } : null,
          image2Details: image2 ? {
            name: image2.name,
            type: image2.type,
            size: image2.size
          } : null,
          tutorialStep: state.ui.tutorialStep,
          fullState: JSON.stringify(state, (key, value) => {
            if (value instanceof File) {
              return {
                name: value.name,
                type: value.type,
                size: value.size
              };
            }
            return value;
          }, 2)
        });

        dispatch({ type: 'SET_LAST_MOUSE_POSITION', position: { x: offsetX, y: offsetY } });

        if (!image1 || !image2) {
          console.log('Missing images:', {
            image1Missing: !image1,
            image2Missing: !image2,
            image1Details: image1,
            image2Details: image2
          });
          dispatch({ type: 'SET_ERROR', error: "You need to have uploaded both images before drawing trajectory" });
          return;
        }

        const pointIndex = state.drawing.anchorPoints.findIndex(point => 
          Math.hypot(point.x - offsetX, point.y - offsetY) < INTERACTION.POINT_SELECTION_RADIUS
        );

        if (pointIndex !== -1) {
          dispatch({ type: 'SET_SELECTED_POINT', index: pointIndex });
          dispatch({ type: 'SET_MODE', mode: 'draggingPoint' });
          dispatch({ type: 'SET_ERROR', error: null });
        } else if (state.drawing.anchorPoints.length === 0) {
          dispatch({ type: 'SET_MODE', mode: 'drawing' });
          dispatch({ type: 'SET_CURRENT_DRAW_POINTS', points: [{ x: offsetX, y: offsetY }] });
          dispatch({ type: 'SET_ERROR', error: null });
        }
      } catch (err) {
        console.error('Interaction error:', err);
        dispatch({ type: 'SET_ERROR', error: (err as Error).message });
        resetInteraction();
      }
    },
    [state.images.images, state.drawing.anchorPoints, state.ui.tutorialStep]
  );

  const dragLine = useCallback((e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    // Future implementation if needed
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      try {
        if (state.drawing.interactionMode !== 'drawing') return;

        const { offsetX, offsetY } = e.nativeEvent;
        dispatch({ type: 'ADD_DRAW_POINT', point: { x: offsetX, y: offsetY } });
        dispatch({ type: 'SET_ERROR', error: null });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: (err as Error).message });
        resetInteraction();
      }
    },
    [state.drawing.interactionMode]
  );

  const stopDrawing = useCallback(() => {
    try {
      if (state.drawing.interactionMode !== 'drawing' || state.drawing.currentDrawPoints.length < 2) {
        dispatch({ type: 'SET_MODE', mode: 'idle' });
        dispatch({ type: 'SET_CURRENT_DRAW_POINTS', points: [] });
        return;
      }

      const interpolated = interpolatePoints(state.drawing.currentDrawPoints, state.drawing.numPoints);
      if (!interpolated || interpolated.length === 0) {
        throw new Error("Failed to interpolate points");
      }

      dispatch({ type: 'SET_ANCHOR_POINTS', points: interpolated });
      dispatch({ type: 'SET_MODE', mode: 'idle' });
      dispatch({ type: 'SET_CURRENT_DRAW_POINTS', points: [] });
      dispatch({ type: 'SET_ERROR', error: null });
      dispatch({ type: 'SET_TUTORIAL_STEP', step: 'review' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      resetInteraction();
    }
  }, [state.drawing.interactionMode, state.drawing.currentDrawPoints, state.drawing.numPoints]);

  const dragPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      if (state.drawing.interactionMode !== 'draggingPoint' || state.drawing.selectedPointIndex === null) return;

      const { offsetX, offsetY } = e.nativeEvent;
      const selectedPoint = state.drawing.anchorPoints[state.drawing.selectedPointIndex];
      const dx = offsetX - selectedPoint.x;
      const dy = offsetY - selectedPoint.y;

      try {
        dispatch({ type: 'SET_ANCHOR_POINTS', points: state.drawing.anchorPoints.map((point, index) => {
          if (index === state.drawing.selectedPointIndex) {
            return { x: offsetX, y: offsetY };
          }

          const distance = Math.hypot(point.x - selectedPoint.x, point.y - selectedPoint.y);

          if (distance < INTERACTION.DRAG_INFLUENCE_RADIUS) {
            const influence = Math.pow(1 - distance / INTERACTION.DRAG_INFLUENCE_RADIUS, 2);
            return {
              x: point.x + dx * influence,
              y: point.y + dy * influence
            };
          }

          return point;
        }) });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      }
    },
    [state.drawing.interactionMode, state.drawing.selectedPointIndex, state.drawing.anchorPoints]
  );

  const stopDraggingPoint = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: 'idle' });
    dispatch({ type: 'SET_SELECTED_POINT', index: null });
  }, []);

  const resetInteraction = useCallback(() => {
    dispatch({ type: 'SET_MODE', mode: 'idle' });
    dispatch({ type: 'SET_SELECTED_POINT', index: null });
    dispatch({ type: 'SET_CURRENT_DRAW_POINTS', points: [] });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      if (state.drawing.interactionMode === 'drawing') {
        draw(e);
      } else if (state.drawing.interactionMode === 'draggingPoint') {
        dragPoint(e);
      }
    },
    [state.drawing.interactionMode, draw, dragPoint]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      if (state.drawing.interactionMode === 'drawing') {
        stopDrawing();
      } else if (state.drawing.interactionMode === 'draggingPoint') {
        stopDraggingPoint();
      }
    },
    [state.drawing.interactionMode, stopDrawing, stopDraggingPoint]
  );

  const handleSliderChange = useCallback((value: number[]) => {
    dispatch({ type: 'SET_TRANSITION_PROGRESS', progress: value[0] / 100 });
    dispatch({ type: 'SET_HAS_USED_SLIDER', value: true });
    dispatch({ type: 'SET_TUTORIAL_STEP', step: 'generate' });
  }, []);

  const handleNumPointsChange = useCallback(
    (value: string) => {
      try {
        const newNumPoints = parseInt(value);
        if (isNaN(newNumPoints) || newNumPoints < DEFAULTS.MIN_FRAMES || newNumPoints > DEFAULTS.MAX_FRAMES) {
          throw new Error(`Number of frames must be between ${DEFAULTS.MIN_FRAMES} and ${DEFAULTS.MAX_FRAMES}`);
        }

        if (state.drawing.anchorPoints.length > 1) {
          const interpolated = interpolatePoints(state.drawing.anchorPoints, newNumPoints);
          
          if (interpolated.length === newNumPoints) {
            dispatch({ type: 'SET_ANCHOR_POINTS', points: interpolated });
            dispatch({ type: 'SET_NUM_POINTS', count: newNumPoints });
          } else {
            // As a fallback, fill in missing points by duplicating the last point
            while (interpolated.length < newNumPoints) {
              interpolated.push({ ...interpolated[interpolated.length - 1] });
            }
            dispatch({ type: 'SET_ANCHOR_POINTS', points: interpolated });
            dispatch({ type: 'SET_NUM_POINTS', count: newNumPoints });
          }
        } else {
          // If there's only one point or none, just update the number of points
          dispatch({ type: 'SET_NUM_POINTS', count: newNumPoints });
        }
        dispatch({ type: 'SET_ERROR', error: null });
      } catch (err) {
        console.error('handleNumPointsChange error:', err);
        dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      }
    },
    [state.drawing.anchorPoints]
  );

  const clearTrajectory = useCallback(() => {
    try {
      dispatch({ type: 'RESET_TRAJECTORY' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
    }
  }, []);

  const getMissingElements = useCallback(() => {
    const missing: string[] = [];
    if (!state.images.images[1]) missing.push('starting image');
    if (!state.images.images[2]) missing.push('ending image');
    if (state.drawing.anchorPoints.length === 0) missing.push('trajectory');
    if (!state.ui.motionPrompt.trim()) missing.push('motion prompt');
    return missing;
  }, [state.images.images, state.drawing.anchorPoints, state.ui.motionPrompt]);

  useEffect(() => {
    console.log('useEffect: Images State Updated:', {
      image1: state.images.images[1]?.name,
      image2: state.images.images[2]?.name,
      tutorialStep: state.ui.tutorialStep,
    });
  }, [state.images.images, state.ui.tutorialStep]);

  const handleGenerate = () => {
    dispatch({ type: 'SET_GENERATING', isGenerating: true });
    // Simulate API call - remove this setTimeout in production
    setTimeout(() => {
      dispatch({ type: 'SET_GENERATING', isGenerating: false });
    }, 3000);
  };

  return (
    <Card className="p-6 w-full max-w-2xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Interpolate with drawn trajectory guidance
        </h1>
        
        {/* Priority 1: Missing images message */}
        {(!state.images.images[1] || !state.images.images[2]) && state.ui.tutorialStep === 'upload' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
            {(!state.images.images[1] && !state.images.images[2]) && "Add images to drive the motion"}
            {(state.images.images[1] && !state.images.images[2]) && "Add an ending image to drive the motion"}
            {(!state.images.images[1] && state.images.images[2]) && "Add a starting image to drive the motion"}
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <div className="flex-1 flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
              <ImagePlus size={20} />
              <span>Start Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 1)}
                className="hidden"
              />
            </label>
            {state.images.images[1] && state.images.imageURLs[1] && (
              <div className="w-12 h-12 border rounded overflow-hidden relative group">
                <img
                  src={state.images.imageURLs[1]}
                  alt="Start preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveImage(1)}
                  className="absolute top-0 right-0 m-1 p-1 rounded-full bg-white bg-opacity-75 hover:bg-opacity-100 hidden group-hover:block"
                >
                  <X size={12} className="text-gray-700" />
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
              <ImagePlus size={20} />
              <span>End Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 2)}
                className="hidden"
              />
            </label>
            {state.images.images[2] && state.images.imageURLs[2] && (
              <div className="w-12 h-12 border rounded overflow-hidden relative group">
                <img
                  src={state.images.imageURLs[2]}
                  alt="End preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveImage(2)}
                  className="absolute top-0 right-0 m-1 p-1 rounded-full bg-white bg-opacity-75 hover:bg-opacity-100 hidden group-hover:block"
                >
                  <X size={12} className="text-gray-700" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Priority 2: Draw trajectory message */}
        {(state.images.images[1] && state.images.images[2] && state.drawing.anchorPoints.length === 0 && state.ui.tutorialStep === 'draw') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
            Draw the desired trajectory of the motion onto the image
          </div>
        )}

        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={startInteraction}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => resetInteraction()}
            className="border rounded w-full cursor-crosshair"
          />
          {state.ui.error && state.drawing.lastMousePosition && (
            <div 
              className="absolute px-2 py-1 bg-black/75 text-white text-xs rounded pointer-events-none animate-in fade-in-0 duration-200"
              style={{
                left: `${state.drawing.lastMousePosition.x}px`,
                top: `${state.drawing.lastMousePosition.y - 32}px`
              }}
            >
              {state.ui.error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {/* Priority 3: Review motion message */}
          {(state.images.images[1] && state.images.images[2] && state.drawing.anchorPoints.length > 0 && !state.transition.hasUsedSlider && state.ui.tutorialStep === 'review') && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm mb-4">
              Review the motion using the slider below - and edit it by dragging the trajectory
            </div>
          )}

          <div className="flex items-center gap-4">
            <Select 
              value={state.drawing.numPoints.toString()} 
              onValueChange={handleNumPointsChange}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Number of frames" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="overflow-y-auto">
                  {Array.from({ length: DEFAULTS.MAX_FRAMES - DEFAULTS.MIN_FRAMES + 1 }, (_, i) => {
                    const num = DEFAULTS.MIN_FRAMES + i;
                    return (
                      <SelectItem key={num} value={num.toString()}>
                        {num} frames
                      </SelectItem>
                    );
                  })}
                </div>
              </SelectContent>
            </Select>

            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Visualise trajectory</h3>
              <div className="py-2 relative group">
                <Slider
                  defaultValue={[0]}
                  max={DEFAULTS.SLIDER_MAX}
                  step={DEFAULTS.SLIDER_STEP}
                  value={[state.transition.transitionProgress * 100]}
                  onValueChange={handleSliderChange}
                  disabled={!state.images.images[1] || !state.images.images[2]}
                  className={cn(
                    "w-full",
                    (!state.images.images[1] || !state.images.images[2]) && "cursor-not-allowed opacity-50"
                  )}
                />
                {(!state.images.images[1] || !state.images.images[2]) && (
                  <div className="absolute inset-0 hidden group-hover:block">
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-black/75 text-white text-xs rounded">
                      Please upload both images first
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={clearTrajectory} 
              variant="outline" 
              className="flex items-center gap-2 h-10"
            >
              <Eraser size={16} />
              Clear
            </Button>
          </div>
        </div>

        {/* Priority 4: Generate message */}
        {(state.images.images[1] && state.images.images[2] && state.drawing.anchorPoints.length > 0 && state.transition.hasUsedSlider && state.ui.tutorialStep === 'generate' && !state.ui.motionPrompt.trim()) && (
          <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
            Add a prompt and generate!
          </div>
        )}

        {/* Motion Prompt Input */}
        <div className="mt-6">
          <label 
            htmlFor="motionPrompt" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Motion Prompt
          </label>
          <textarea
            id="motionPrompt"
            rows={3}
            value={state.ui.motionPrompt}
            onChange={(e) => dispatch({ type: 'SET_MOTION_PROMPT', prompt: e.target.value })}
            placeholder="Describe the motion you'd like to see in the video"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-2">
          <div className="relative group">
            <Button 
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              size="lg"
              disabled={getMissingElements().length > 0}
              onClick={handleGenerate}
            >
              Generate video
            </Button>
            
            {getMissingElements().length > 0 && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-black/75 text-white text-xs rounded hidden group-hover:block">
                You're missing the {getMissingElements().join(', ')}
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={() => {
            dispatch({ type: 'SET_TUTORIAL_STEP', step: 'upload' });
          }}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          Reset Help Messages
        </Button>
      </div>

      {state.ui.isGenerating && (
        <Modal isOpen={state.ui.isGenerating}>
          <div className={styles.title}>
            Generating your video
          </div>
          <div className={styles.content}>
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-center text-sm text-gray-500">
              This is a placeholder message made to give the illusion of a loading state.
            </p>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default TrajectoryDrawer;