
 int rx = A0,
     ry = A2,
     lx = A3,
     ly = A4,
     rt = A6,
     lt = A7,
     p1 = A9,
     p2 = A10,
     p3 = A11,
     br = A12,
     bl = A13,
     bx = A6,
     rs = A1,
     ls = A5,
     by = A8;

RF24 radio(9, 8);
const byte address[6] = "00001";

struct Data_Package {
  int LxValue;
  int LyValue;
  int LtValue;
  int RxValue;
  int RyValue;
  int RtValue;
  int P1Value;
  int P2Value;
  int P3Value;
  int BrValue;
  int BlValue;
  int BxValue;
  int RsValue;
  int LsValue;
  int ByValue;
};

Data_Package data;
unsigned long currentMillis;
unsigned long prevMillis;
unsigned long txIntervalMillis = 50;

void setup() {
  Serial.begin(9600);
  radio.begin();
  radio.openWritingPipe(address);
  radio.setAutoAck(false);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);
}

void readData(){
    data.RxValue = analogRead(rx);
    data.RyValue = analogRead(ry);
    data.LxValue = analogRead(lx);
    data.LyValue = analogRead(ly);
    data.RtValue = analogRead(rt);
    data.LtValue = analogRead(lt);
    data.P1Value = analogRead(p1);
    data.P2Value = analogRead(p2);
    data.P3Value = analogRead(p3);
    data.BrValue = analogRead(br);
    data.BlValue = analogRead(bl);
    data.BxValue = analogRead(bx);
    data.RsValue = analogRead(rs);
    data.LsValue = analogRead(ls);
    data.ByValue = analogRead(by);
}

void loop() {
  currentMillis = millis();
  if (currentMillis - prevMillis >= txIntervalMillis) {
    readData();
    radio.write(&data, sizeof(Data_Package));
    Serial.println(analogRead(br));
    prevMillis = millis();
  }
}
