def br_motor_drive():
    global BrSmooth, BrPrev

    # Drive Back Right Motor
    x = RxValue
    y = RyValue

    # Map joystick values
    Xmap = int((x - 0) * (255 - (-255)) / (1023 - 0) + (-255))
    Ymap = int((y - 0) * ((-255) - 255) / (1023 - 0) + 255)

    cs = Xmap + Ymap

    # Deadzone
    if -20 < cs < 20:
        cs = 0

    # Clamp
    cs = max(min(cs, 255), -255)

    # Smoothing
    cs *= 100
    BrSmooth = (cs * 0.1) + (BrPrev * 0.90)
    BrPrev = BrSmooth
    BrSmooth = int(BrSmooth / 100)

    # Direction + PWM
    if BrSmooth > 0:
        analog_write(CENA, BrSmooth)
        digital_write(CIN1, LOW)
        digital_write(CIN2, HIGH)
    else:
        analog_write(CENA, abs(BrSmooth))
        digital_write(CIN1, HIGH)
        digital_write(CIN2, LOW)
