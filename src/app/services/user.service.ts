import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private userArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshUsers();
  }

  refreshUsers(){
    this.httpClient.get('api/users').subscribe((users: any) => {
      this.userArray = users;
    })
  }
  getAllUsers() {
    return this.userArray;
  }

  addUser(userSent: any) {

    let user = {
      username: userSent.username,
      password: userSent.password,
      token: userSent.token,
      role: userSent.role
    }

    this.httpClient.post('api/users', user).subscribe(() => {
      this.refreshUsers();
    });
  }

  updateUser(userSent: any){
    let user = {
      id: userSent.id,
      username: userSent.username,
      password: userSent.password,
      token: userSent.token,
      role: userSent.role,
    };
    this.httpClient.post('api/users', user).subscribe((userReceived: any) => {
      this.userArray = this.userArray.map(p => {
        if(p.id === userReceived.id){
          return userReceived;
        }
        return p;
      });
    });

  }

  removeUser(id: number){
    this.userArray = this.userArray.filter(user => user.id !== id);
    this.httpClient.delete('api/users/' + id).subscribe(() => {
      this.refreshUsers();
    });

  }
}
