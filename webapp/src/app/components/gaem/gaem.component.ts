import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { GaemService } from 'src/app/services/gaem/gaem.service';
import { Card } from 'src/app/models/card';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Subscription, timer } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gaem',
  templateUrl: './gaem.component.html',
  styleUrls: ['./gaem.component.css'],
  animations: [
    trigger('addedRemoved', [
      state(
        'added',
        style({
          opacity: '100%',
          position: 'relative',
          top: '0rem',
        })
      ),
      state(
        'removed',
        style({ opacity: '0%', position: 'relative', top: '3rem' })
      ),
      // NOTE: do not change these without also changing the timeouts
      transition('added => removed', [animate('1s')]),
      transition('removed => added', [animate('0.5s')]),
    ]),
  ],
})
export class GaemComponent implements OnInit {
  public deckCards: Card[] = [];
  public fightingZones: Card[][] = [[], []];
  public roundNum: number = 1;
  public secondsElapsed: number = 90;
  public roundTimes: number[] = [];
  public timer = timer(1000, 1000);
  public coinsEarned: number = 100;
  public waitingForResp = false;

  private subscription?: Subscription;
  showWinModal = false;
  showLoseModal = false;

  constructor(private service: GaemService, private router: Router) {
    this.service.onReset(() => {
      this.reset();
    });
  }

  reset() {
    this.deckCards = [];
    this.addToDeck(this.service.serveHand(4));
    this.fightingZones = [[], []];
    this.roundNum = 1;

    this.resetTimer();

    this.roundTimes = [];

    this.showLoseModal = false;
    this.showWinModal = false;
  }

  resetTimer() {
    if (this.subscription !== undefined) {
      this.subscription.unsubscribe();
    }

    this.timer = timer(1000, 1000);
    this.secondsElapsed = 30;
    this.subscription = this.timer.subscribe((val) => {
      this.secondsElapsed = 30 - (val + 1);

      if (this.secondsElapsed <= 0) {
        this.secondsElapsed = 0;
      }
    });
  }

  addToDeck(newCards: Card[]) {
    this.deckCards = this.deckCards.concat(newCards);

    setTimeout(() => {
      this.deckCards.forEach((card) => {
        card.added = true;
      });
    }, 500);
  }

  ngOnInit(): void {
    this.reset();
  }

  dropCard(event: CdkDragDrop<Card[]>, targetNumber: number = 0) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else if (targetNumber > 0) {
      if (event.container.data.length == 0) {
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex
        );
        // event.container.element.nativeElement.classList.remove('h-48');
        // event.container.element.nativeElement.classList.remove('w-32');
      }
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      // event.previousContainer.element.nativeElement.classList.add('h-48');
      // event.previousContainer.element.nativeElement.classList.add('w-32');
    }
  }

  canBeDroppedToFight(drag: CdkDrag, drop: CdkDropList) {
    return drop.data.length === 0;
  }

  canBeDroppedToDeck(drag: CdkDrag, drop: CdkDropList) {
    return true;
  }

  hasEmptyFightingZones(): boolean {
    const numFightingZones = this.fightingZones.length;
    const filledFightingZones = this.numCardsInFightingZones();

    return numFightingZones !== filledFightingZones;
  }

  numCardsInFightingZones(): number {
    return this.fightingZones
      .filter((zone) => zone.length > 0)
      .filter((zone) => zone[0].isAlive() && zone[0].added).length;
  }

  availableSpaceInDeck(): number {
    return 4 - this.deckCards.length;
  }

  continue() {
    if (this.waitingForResp) {
      return;
    }

    let message = 'Next round started';
    let toContinue = true;

    if (this.hasEmptyFightingZones() && this.deckCards.length > 0) {
      message =
        'There are empty fighting zones and you have cards left on your deck!';
      toContinue = false;
    }

    if (this.numCardsInFightingZones() === 0) {
      message = 'No cards in fighting zone!';
      toContinue = false;
    }

    console.log(this.fightingZones);
    console.log(toContinue, message);

    if (toContinue) {
      this.waitingForResp = true;
      this.roundTimes.push(this.secondsElapsed);

      setTimeout(() => {
        this.roundNum += 1;
        this.waitingForResp = false;

        // TODO: remove this sim
        this.roundCompleted([40, 70]);

        this.resetTimer();

        if (this.noCardsLeft()) {
          this.showLoseModal = true;
        }
      }, 2000);
    }
  }

  roundCompleted(damages: number[]) {
    this.fightingZones.forEach((cards, index) => {
      if (cards.length > 0) {
        const damage = damages.shift();
        if (damage !== undefined) {
          const alive = cards[0].takeDamage(damage);
          if (!alive) {
            this.cardDied(index);
          }
        }
      }
    });

    this.addToDeck(
      this.service.serveHand(
        this.availableSpaceInDeck() - this.numCardsInFightingZones()
      )
    );
  }

  noCardsLeft(): boolean {
    return (
      this.availableSpaceInDeck() == 4 && this.numCardsInFightingZones() == 0
    );
  }

  cardDied(zoneIndex: number) {
    console.log(`Killing card with index ${zoneIndex}`);
    const removedCard = this.fightingZones[zoneIndex][0];
    if (removedCard !== undefined) {
      removedCard.added = false;
    }

    setTimeout(() => {
      this.fightingZones[zoneIndex].shift();
    }, 1000);
  }

  playAgain() {
    this.router.navigateByUrl('/');
  }
}
