import classnames from 'classnames';
import * as joint from 'jointjs';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Nav, NavItem, NavLink } from 'reactstrap';

import 'jointjs/dist/joint.css';

import '../../jointjs/joint-tm.css';
import '../../jointjs/shapes';

import './model.css';

import { getThreatDragonDiagramJson } from '@eop/shared';
import type { ThreatDragonModel } from '@eop/shared';

const SCROLL_SPEED = 1000;
const DRAG_THRESHOLD = 8;
const DESKTOP_ONLY_PAPER_EVENTS = ['touchstart', 'touchstart .joint-link .label'];
const DESKTOP_ONLY_DOCUMENT_EVENTS = ['touchmove', 'touchend', 'touchcancel'];

let desktopPaperCtor: typeof joint.dia.Paper | null = null;

type ModelProps = {
  model: ThreatDragonModel;
  selectedDiagram: number;
  selectedComponent: string;
  canSelect: boolean;
  onSelectDiagram?: (id: number) => void;
  onSelectComponent?: (id: string) => void;
};

const Model: FC<ModelProps> = ({
  model,
  selectedDiagram,
  selectedComponent,
  canSelect,
  onSelectDiagram,
  onSelectComponent,
}) => {
  const [graph] = useState(
    new joint.dia.Graph({}, { cellNamespace: joint.shapes }),
  );

  const createPaper = useCallback(
    (el?: HTMLElement) =>
      new (getPaperConstructor())({
        el,
        width: window.innerWidth,
        height: window.innerHeight,
        model: graph,
        interactive: false,
        gridSize: 10,
        drawGrid: true,
      }),
    [graph],
  );

  const [paper, setPaper] = useState(createPaper());
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const blankPointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const placeholderRef = useCallback(
    (el: HTMLDivElement | null) => {
      canvasRef.current = el;
      if (el !== null) {
        setPaper(createPaper(el));
      }
    },
    [createPaper],
  );

  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    graph.fromJSON(
      getThreatDragonDiagramJson(model.detail.diagrams[selectedDiagram]),
    );
    //paper.fitToContent(1, 1, 10, { allowNewOrigin: "any" });
  }, [graph, model, selectedDiagram]);

  useEffect(() => {
    // unhighlight all
    paper.model.getElements().forEach((e) => {
      paper.findViewByModel(e).unhighlight();
    });
    paper.model.getLinks().forEach((e) => {
      paper.findViewByModel(e).unhighlight();
    });

    // highlight the selected component
    const selectedComponentView = paper.findViewByModel(selectedComponent);
    if (selectedComponentView) {
      selectedComponentView.highlight();
    }
  }, [paper, selectedComponent]);

  useEffect(() => {
    const setDragPositionScaled = (x: number, y: number) => {
      const scale = joint.V(paper.layers).scale();
      setDragPosition({ x: x * scale.sx, y: y * scale.sy });
    };

    const onCellPointerDown = (cellView: joint.dia.CellView) => {
      if (
        canSelect &&
        cellView.model.attributes.type !== 'tm.Boundary' &&
        cellView.model.attributes.type !== 'tm.BoundaryBox'
      ) {
        onSelectComponent?.(cellView.model.id.toString());
      }
    };

    const onBlankPointerDown = (
      _event: joint.dia.Event,
      x: number,
      y: number,
    ) => {
      blankPointerDownRef.current = { x, y };
    };

    const stopDragging = (x: number, y: number) => {
      setDragging(false);
      setDragPositionScaled(x, y);
    };

    const onCellPointerUp = (
      _cellView: joint.dia.CellView,
      _event: joint.dia.Event,
      x: number,
      y: number,
    ) => {
      blankPointerDownRef.current = null;
      if (dragging) {
        stopDragging(x, y);
      }
    };

    const onBlankPointerUp = (
      _event: joint.dia.Event,
      x: number,
      y: number,
    ) => {
      blankPointerDownRef.current = null;
      if (dragging) {
        stopDragging(x, y);
        return;
      }
      if (canSelect) {
        onSelectComponent?.('');
      }
    };

    paper.on('cell:pointerdown', onCellPointerDown);
    paper.on('blank:pointerdown', onBlankPointerDown);
    paper.on('cell:pointerup', onCellPointerUp);
    paper.on('blank:pointerup', onBlankPointerUp);

    return () => {
      paper.off('cell:pointerdown', onCellPointerDown);
      paper.off('blank:pointerdown', onBlankPointerDown);
      paper.off('cell:pointerup', onCellPointerUp);
      paper.off('blank:pointerup', onBlankPointerUp);
    };
  }, [canSelect, dragging, paper, onSelectComponent]);

  const mouseWheel = useCallback(
    (e: WheelEvent) => {
      const delta = -e.deltaY / SCROLL_SPEED;
      const newScale = joint.V(paper.layers).scale().sx + delta;
      paper.translate(0, 0);
      const p = offsetToLocalPoint(e.offsetX, e.offsetY, paper);
      paper.scale(newScale, newScale, p.x, p.y);
    },
    [paper],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener('wheel', mouseWheel, { passive: true });
    return () => {
      canvas.removeEventListener('wheel', mouseWheel);
    };
  }, [mouseWheel]);

  const mouseMove = useCallback(
    ({ nativeEvent: e }: React.MouseEvent) => {
      const localPoint = offsetToLocalPoint(e.offsetX, e.offsetY, paper);
      const pressedPointer = blankPointerDownRef.current;
      if (
        !dragging &&
        pressedPointer &&
        Math.hypot(
          pressedPointer.x - localPoint.x,
          pressedPointer.y - localPoint.y,
        ) >= DRAG_THRESHOLD
      ) {
        setDragging(true);
        setDragPosition({ x: e.offsetX, y: e.offsetY });
        return;
      }

      if (dragging) {
        const x = e.offsetX;
        const y = e.offsetY;
        paper.translate(x - dragPosition.x, y - dragPosition.y);
      }
    },
    [dragging, paper, dragPosition.x, dragPosition.y],
  );

  return (
    <div className="model">
      <div>
        <title>EoP - {model.summary.title}</title>
        <h1 style={{ padding: '10px 15px' }}>{model.summary.title}</h1>
        <Nav tabs>
          {model.detail.diagrams.map((d, idx) => (
            <NavItem key={idx}>
              <NavLink
                className={classnames({
                  active: selectedDiagram === idx,
                })}
                onClick={() => {
                  if (canSelect) {
                    onSelectDiagram?.(idx);
                  }
                }}
              >
                {d.title}
              </NavLink>
            </NavItem>
          ))}
        </Nav>
      </div>
      <div
        className="diagram-canvas"
        ref={placeholderRef}
        onMouseMove={mouseMove}
      />
    </div>
  );
};

export default Model;

const offsetToLocalPoint = (
  offsetX: number,
  offsetY: number,
  paper: joint.dia.Paper,
) => {
  // Finds mouse position in unscaled version
  const svgPoint = paper.svg.createSVGPoint();
  svgPoint.x = offsetX;
  svgPoint.y = offsetY;
  const offsetTransformed = svgPoint.matrixTransform(
    paper.layers.getCTM()?.inverse(),
  );
  return offsetTransformed;
};

function getPaperConstructor(): typeof joint.dia.Paper {
  if (supportsTouch()) {
    return joint.dia.Paper;
  }

  if (desktopPaperCtor) {
    return desktopPaperCtor;
  }

  const paperClass = joint.dia.Paper as typeof joint.dia.Paper & {
    extend: (definition: object) => typeof joint.dia.Paper;
  };
  const prototypeWithEvents = joint.dia.Paper.prototype as typeof joint.dia.Paper.prototype & {
    events: Record<string, string>;
    documentEvents: Record<string, string>;
  };

  const paperCtor = paperClass.extend({
    events: omitJointEvents(prototypeWithEvents.events, [
      'wheel',
      ...DESKTOP_ONLY_PAPER_EVENTS,
    ]),
    documentEvents: omitJointEvents(
      prototypeWithEvents.documentEvents,
      DESKTOP_ONLY_DOCUMENT_EVENTS,
    ),
  });

  desktopPaperCtor = paperCtor;

  return paperCtor;
}

function supportsTouch(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function omitJointEvents(
  events: Record<string, string>,
  namesToOmit: string[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(events).filter(
      ([eventName]) => !namesToOmit.includes(eventName),
    ),
  );
}
