import { GameMode, getCardCssClass, getValidMoves } from '@eop/shared';
import { useRef, useState } from 'react';

import type React from 'react';
import type { Card, Suit } from '@eop/shared';

interface DeckProps {
  suit?: Suit;
  cards: Card[];
  isInThreatStage: boolean;
  round: number;
  current: boolean;
  active: boolean;
  onCardSelect: (e: Card) => void;
  startingCard: Card;
  gameMode: GameMode;
}

const Deck: React.FC<DeckProps> = ({
  suit,
  cards,
  isInThreatStage = false,
  round,
  current,
  active,
  onCardSelect,
  startingCard,
  gameMode,
}) => {
  const validMoves: Card[] =
    current && active && !isInThreatStage
      ? getValidMoves(cards, suit, round, startingCard)
      : [];
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);

  const roundedClass =
    gameMode === GameMode.CUMULUS ? `card-rounded-cumulus` : `card-rounded`;
  const handWidth = `calc(${Math.max(cards.length - 1, 0) * 3}em + 16em)`;

  return (
    <div className="playingCards">
      <div
        className="handViewport"
        onWheel={(event) => {
          const scrollbar = scrollbarRef.current;
          if (!scrollbar) {
            return;
          }

          const delta =
            event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;

          if (delta === 0) {
            return;
          }

          const previousScrollLeft = scrollbar.scrollLeft;
          scrollbar.scrollLeft += delta;

          if (scrollbar.scrollLeft !== previousScrollLeft) {
            event.preventDefault();
          }
        }}
      >
        <ul className="hand" style={{ width: handWidth, left: `-${scrollLeft}px` }}>
          {cards.map((card) => (
            <li
              aria-label={`Card in hand: ${card}${
                validMoves.includes(card) ? ' (can be played)' : ''
              }`}
              key={`card-in-hand-${card}`}
              className={`playing-card ${getCardCssClass(gameMode, card)} ${
                validMoves.includes(card) ? 'active' : ''
              } ${roundedClass} scaled`}
              onClick={() => onCardSelect(card)}
            />
          ))}
        </ul>
      </div>
      <div
        aria-hidden="true"
        className="handScrollbar"
        ref={scrollbarRef}
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
        }}
      >
        <div className="handScrollbarSpacer" style={{ width: handWidth }} />
      </div>
    </div>
  );
};

export default Deck;
