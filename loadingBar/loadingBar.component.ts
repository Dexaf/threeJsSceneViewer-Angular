import { Component, input } from "@angular/core";

@Component({
  template: `
  <div class="zone-expander">
    <div class="progress-container">
      <div class="progress-bar" id="progress-bar" [style]="'width: ' + loadingProgressPercentage() + '%;'"></div>
    </div>
  </div>
  `,
  selector: "loading-bar-component",
  styleUrl: './loadingBar.component.css'
})
export class LoadingBarComponent {
  loadingProgressPercentage = input<number>();
}