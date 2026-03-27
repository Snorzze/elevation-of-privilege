import type { PlayerID } from 'boardgame.io';
import type { GameState } from '../game/gameState';
import type {
  DiagramJson,
  ImportedThreatDragonCell,
  ThreatDragonComponent,
  ThreatDragonDiagram,
  ThreatDragonLabel,
  ThreatDragonModel,
  ThreatDragonThreat,
  ThreatDragonTerminus,
} from '../game/ThreatDragonModel';
import type { Card, Suit } from './cardDefinitions';
import { ModelType } from './constants';

const DEFAULT_LABEL_STYLE = {
  'font-size': 'small',
  'font-weight': '400',
} as const;

const SHAPE_TO_TYPE: Record<string, ThreatDragonComponent['type']> = {
  actor: 'tm.Actor',
  flow: 'tm.Flow',
  process: 'tm.Process',
  store: 'tm.Store',
  'trust-boundary-box': 'tm.Boundary',
  'trust-boundary-curve': 'tm.Boundary',
};

const TYPE_ALIASES: Record<string, ThreatDragonComponent['type']> = {
  'tm.Actor': 'tm.Actor',
  'tm.Boundary': 'tm.Boundary',
  'tm.BoundaryBox': 'tm.Boundary',
  'tm.BoundaryCurve': 'tm.Boundary',
  'tm.Flow': 'tm.Flow',
  'tm.Process': 'tm.Process',
  'tm.Store': 'tm.Store',
};

export function getDealtCard(G: GameState): string {
  if (G.dealt.length > 0 && G.dealtBy) {
    return G.dealt[Number.parseInt(G.dealtBy)] ?? '';
  }
  return '';
}

export function resolvePlayerNames(
  players: PlayerID[],
  names: string[],
  current: PlayerID | null,
): string[] {
  return players.map((player) => resolvePlayerName(player, names, current));
}

export function resolvePlayerName(
  player: PlayerID,
  names: string[],
  current: PlayerID | null,
): string {
  return player === current ? 'You' : (names[Number.parseInt(player)] ?? '');
}

export function grammarJoin(arr: string[]): string | undefined {
  const last = arr.pop();

  if (arr.length <= 0) return last;

  return arr.join(', ') + ' and ' + last;
}

export function getPlayers(count: number): string[] {
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push(i + '');
  }
  return players;
}

export function getComponentName(
  component: ThreatDragonComponent | undefined,
): string {
  if (component === undefined) return '';

  const prefix = component.type.slice(3);

  if (component.type === 'tm.Flow') {
    return `${prefix}: ${component.labels?.[0]?.attrs.text.text}`;
  }

  return `${prefix}: ${component.attrs.text?.text}`;
}

export function getThreatDragonDiagramJson(
  diagram: ThreatDragonDiagram | undefined,
): DiagramJson {
  if (!diagram) {
    return { cells: [] };
  }

  if (!diagram.diagramJson) {
    diagram.diagramJson = {
      cells: diagram.cells?.map(normalizeThreatDragonCell) ?? [],
    };
  }

  return diagram.diagramJson;
}

export function getThreatDragonCells(
  diagram: ThreatDragonDiagram | undefined,
): ThreatDragonComponent[] {
  return getThreatDragonDiagramJson(diagram).cells ?? [];
}

export function normalizeThreatDragonModel(
  model: ThreatDragonModel,
): ThreatDragonModel {
  model.detail.diagrams.forEach((diagram) => {
    getThreatDragonDiagramJson(diagram);
  });

  return model;
}

export function setThreatDragonCellThreats(
  diagram: ThreatDragonDiagram | undefined,
  cellId: string,
  threats: ThreatDragonThreat[],
): void {
  if (!diagram) {
    return;
  }

  const cell = getThreatDragonCells(diagram).find((candidate) => {
    return candidate.id === cellId;
  });
  if (cell) {
    cell.hasOpenThreats = threats.length > 0;
    cell.threats = threats;
  }

  const importedCell = diagram.cells?.find((candidate) => candidate.id === cellId);
  if (!importedCell) {
    return;
  }

  importedCell.data = importedCell.data ?? {};
  importedCell.data.hasOpenThreats = threats.length > 0;
  importedCell.data.threats = threats;
}

export function getValidMoves(
  allCardsInHand: Card[],
  currentSuit: Suit | undefined,
  round: number,
  startingCard: Card,
): Card[] {
  if (!currentSuit && round <= 1) {
    return [startingCard];
  }

  const cardsOfSuit = getCardsOfSuit(allCardsInHand, currentSuit);

  return cardsOfSuit.length > 0 ? cardsOfSuit : allCardsInHand;
}

function getCardsOfSuit(cards: Card[], suit: Suit | undefined): Card[] {
  if (!suit) {
    return [];
  }
  return cards.filter((e) => e.startsWith(suit));
}

export function escapeMarkdownText(text: string): string {
  //replaces certain characters with an escaped version
  //doesn't escape * or _ to allow users to format the descriptions

  return text
    .replace(/[![\]()]/gm, '\\$&')
    .replace(/</gm, '&lt;')
    .replace(/>/gm, '&gt;');
}

export function getImageExtension(filename: string): string | undefined {
  const pattern = new RegExp(`\\.(?<extension>\\w+)$`);
  const matches = filename.match(pattern);
  if (matches && matches.groups && matches.groups.extension) {
    return matches.groups.extension;
  }
  return undefined;
}

export function asyncSetTimeout<U, F extends () => Promise<U>>(
  callback: F,
  delay: number,
): Promise<U> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      callback().then(resolve, reject);
    }, delay);
  });
}

export function logEvent(message: string): void {
  const now = new Date(Date.now()).toISOString();
  console.log(`${now} - ${message}`);
}

export function isModelType(value: string): value is ModelType {
  return Object.values<string>(ModelType).includes(value);
}

function normalizeThreatDragonCell(
  cell: ImportedThreatDragonCell,
): ThreatDragonComponent {
  const type = resolveThreatDragonCellType(cell);
  const hasOpenThreats = cell.data?.hasOpenThreats ?? cell.hasOpenThreats ?? false;
  const outOfScope = cell.data?.outOfScope ?? cell.outOfScope ?? false;
  const normalizedCell: ThreatDragonComponent = {
    id: cell.id,
    type,
    attrs: normalizeThreatDragonAttrs(cell, type, hasOpenThreats, outOfScope),
    size: cell.size ?? { width: cell.width ?? 0, height: cell.height ?? 0 },
    z: cell.z ?? cell.zIndex ?? 0,
  };

  normalizedCell.angle = cell.angle;
  normalizedCell.description = cell.data?.description ?? cell.description;
  normalizedCell.handlesCardPayment =
    cell.data?.handlesCardPayment ?? cell.handlesCardPayment;
  normalizedCell.handlesGoodsOrServices =
    cell.data?.handlesGoodsOrServices ?? cell.handlesGoodsOrServices;
  normalizedCell.hasOpenThreats = hasOpenThreats;
  normalizedCell.isALog = cell.data?.isALog ?? cell.isALog;
  normalizedCell.isWebApplication =
    cell.data?.isWebApplication ?? cell.isWebApplication;
  normalizedCell.isEncrypted = cell.data?.isEncrypted ?? cell.isEncrypted;
  normalizedCell.isSigned = cell.data?.isSigned ?? cell.isSigned;
  normalizedCell.isTrustBoundary =
    cell.data?.isTrustBoundary ?? cell.isTrustBoundary;
  normalizedCell.labels = normalizeThreatDragonLabels(cell.labels, cell.data?.name);
  normalizedCell.outOfScope = outOfScope;
  normalizedCell.position = cell.position;
  normalizedCell.privilegeLevel =
    cell.data?.privilegeLevel ?? cell.privilegeLevel;
  normalizedCell.reasonOutOfScope =
    cell.data?.reasonOutOfScope ?? cell.reasonOutOfScope;
  normalizedCell.smooth =
    cell.smooth ?? (cell.connector ? cell.connector === 'smooth' : undefined);
  normalizedCell.source = normalizeThreatDragonTerminus(cell.source);
  normalizedCell.storesCredentials =
    cell.data?.storesCredentials ?? cell.storesCredentials;
  normalizedCell.storesInventory =
    cell.data?.storesInventory ?? cell.storesInventory;
  normalizedCell.target = normalizeThreatDragonTerminus(cell.target);
  normalizedCell.threats = cell.data?.threats ?? cell.threats;
  normalizedCell.vertices = cell.vertices;

  return normalizedCell;
}

function resolveThreatDragonCellType(
  cell: ImportedThreatDragonCell,
): ThreatDragonComponent['type'] {
  const explicitType = normalizeThreatDragonCellType(
    cell.type as string | undefined,
  );
  if (explicitType) {
    return explicitType;
  }

  const dataType = normalizeThreatDragonCellType(
    cell.data?.type as string | undefined,
  );
  if (dataType) {
    return dataType;
  }

  return SHAPE_TO_TYPE[cell.shape ?? ''] ?? 'tm.Actor';
}

function normalizeThreatDragonCellType(
  type: string | undefined,
): ThreatDragonComponent['type'] | undefined {
  if (!type) {
    return undefined;
  }

  return TYPE_ALIASES[type];
}

function normalizeThreatDragonAttrs(
  cell: ImportedThreatDragonCell,
  type: ThreatDragonComponent['type'],
  hasOpenThreats: boolean,
  outOfScope: boolean,
): ThreatDragonComponent['attrs'] {
  if (type === 'tm.Flow' || type === 'tm.Boundary') {
    return {
      '.connection': {
        class: `connection ${formatThreatStateClasses(hasOpenThreats, outOfScope)}`,
      },
      '.marker-target': {
        class: `marker-target ${formatThreatStateClasses(hasOpenThreats, outOfScope)}`,
      },
    };
  }

  return {
    '.element-shape': {
      class: `element-shape ${formatThreatStateClasses(hasOpenThreats, outOfScope)}`,
    },
    '.element-text': {
      class: `element-text ${formatThreatStateClasses(hasOpenThreats, outOfScope)}`,
    },
    text: {
      text: cell.attrs?.text?.text ?? cell.data?.name ?? '',
    },
  };
}

function formatThreatStateClasses(
  hasOpenThreats: boolean,
  outOfScope: boolean,
): string {
  return `${hasOpenThreats ? 'hasOpenThreats' : 'hasNoOpenThreats'} ${
    outOfScope ? 'isOutOfScope' : 'isInScope'
  }`;
}

function normalizeThreatDragonLabels(
  labels: ImportedThreatDragonCell['labels'],
  fallbackLabel: string | undefined,
): ThreatDragonLabel[] | undefined {
  if (labels && labels.length > 0) {
    return labels.map((label) =>
      typeof label === 'string'
        ? {
            position: 0.5,
            attrs: {
              text: {
                ...DEFAULT_LABEL_STYLE,
                text: label,
              },
            },
          }
        : label,
    );
  }

  if (!fallbackLabel) {
    return undefined;
  }

  return [
    {
      position: 0.5,
      attrs: {
        text: {
          ...DEFAULT_LABEL_STYLE,
          text: fallbackLabel,
        },
      },
    },
  ];
}

function normalizeThreatDragonTerminus(
  terminus: ThreatDragonTerminus | undefined,
): ThreatDragonComponent['source'] | undefined {
  if (!terminus) {
    return undefined;
  }

  return {
    id: terminus.id ?? terminus.cell,
    port: terminus.port,
    x: terminus.x,
    y: terminus.y,
  };
}
