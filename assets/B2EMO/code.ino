void BrMotorDrive() {

    //Drive Back Left Motor

    int x = RxValue;
    int y = RyValue;

    //Use both X & Y Joystick values for Omnidirectional Motion
    int Xmap = map(x, 0, 1023, -255, 255);
    int Ymap = map(y, 0, 1023, 255, -255);

    int cs = Xmap + Ymap;

    if (cs < 20 && cs > -20) cs = 0;
    if (cs > 255) cs = 255;
    else if (cs < -255) cs = -255;

    cs = cs * 100;
    BrSmooth = (cs * 0.1) + (BrPrev * 0.90);
    BrPrev = BrSmooth;
    BrSmooth = BrSmooth / 100;

    if (BrSmooth > 0) {
      analogWrite(CENA, BrSmooth);
      digitalWrite(CIN1, LOW);
      digitalWrite(CIN2, HIGH);
    } 
    else {
      analogWrite(CENA, abs(BrSmooth));
      digitalWrite(CIN1, HIGH);
      digitalWrite(CIN2, LOW);
    }
 }
