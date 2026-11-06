import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { ChatCard } from '../index';

const renderCard = (text = 'Great stream today!') =>
  render(
    <ChatCard.Root>
      <ChatCard.Author>Mira</ChatCard.Author>
      <ChatCard.Text>{text}</ChatCard.Text>
    </ChatCard.Root>
  );

describe('ChatCard', () => {
  it('shows the author and the line', () => {
    renderCard();

    expect(screen.getByRole('article')).toHaveTextContent('MiraGreat stream today!');
  });

  it('passes axe', async () => {
    renderCard();

    expect(await axeViolations()).toEqual([]);
  });
});
