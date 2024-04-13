import { Component } from '@angular/core';
import {UserService} from "../../services/user.service";
import {LightComponent} from "../light/light.component";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";

@Component({
  selector: 'app-userpage',
  standalone: true,
  imports: [
    LightComponent,
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    ButtonModule,
    DialogModule,
    ToastModule
  ],
  templateUrl: './userpage.component.html',
  providers: [MessageService],
  styleUrl: './userpage.component.css'
})
export class UserpageComponent {
  user: any = {
    username: '',
    password: '',
    token: '',
    role: '',
  }

  selectedUser: any = {
    username: '',
    password: '',
    token: '',
    role: '',
  }

  dialog1Visible: boolean = false;
  dialog2Visible: boolean = false;

  responsiveOptions: any[] | undefined;

  constructor(protected userService: UserService, private messageService: MessageService) {}

  ngOnInit(){
    this.responsiveOptions = [
      {
        breakpoint: '1400px',
        numVisible: 3,
        numScroll: 3
      },
      {
        breakpoint: '1220px',
        numVisible: 2,
        numScroll: 2
      },
      {
        breakpoint: '1100px',
        numVisible: 1,
        numScroll: 1
      }
    ];
  }

  addUser() {
    this.userService.addUser(this.user);
    this.showAddToast();
  }


  showDialog(user: any, dialogNumber: number) {
    if(dialogNumber === 1){
      this.dialog1Visible = true;
    } else {
      this.dialog2Visible = true;
    }
    // copy the user to selectedUser
    this.selectedUser = {...user};
  }

  hideDialog() {
    this.dialog1Visible = false;
    this.dialog2Visible = false;
  }

  handleTrigger(id: number){
    this.userService.removeUser(id);
  }

  showAddToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un utilisateur a été ajouté' });
  }

  showUpdateToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un utilisateur a été modifié' });
  }

  showDeleteToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un utilisateur a été supprimé' });
  }

}
