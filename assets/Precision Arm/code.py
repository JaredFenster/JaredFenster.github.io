import asyncio
import math
import moteus
import rclpy
from rclpy.node import Node
from rclpy.executors import MultiThreadedExecutor
from sensor_msgs.msg import JointState

#Define query resolution and extra registers
qr = moteus.QueryResolution()
qr._extra = {
    moteus.Register.CONTROL_POSITION: moteus.F32,
    moteus.Register.CONTROL_VELOCITY: moteus.F32,
    moteus.Register.CONTROL_TORQUE: moteus.F32,
    moteus.Register.POSITION_ERROR: moteus.F32,
    moteus.Register.VELOCITY_ERROR: moteus.F32,
    moteus.Register.TORQUE_ERROR: moteus.F32,
    moteus.Register.ENCODER_1_POSITION: moteus.F32,
    moteus.Register.POSITION: moteus.F32,
    moteus.Register.FAULT: moteus.INT8
}

#Create controllers
c1 = moteus.Controller(id=1, query_resolution=qr)
c2 = moteus.Controller(id=2, query_resolution=qr)
c3 = moteus.Controller(id=3, query_resolution=qr)
c4 = moteus.Controller(id=4, query_resolution=qr)
c5 = moteus.Controller(id=5, query_resolution=qr)
c6 = moteus.Controller(id=6, query_resolution=qr)

#Offsets and joint limits
offsets = [0.37, 0.631, 0.789, 0.604, 0.68, 0.53]
joint_limits = [
    [-0.1, 0.1],
    [-0.125, 0.0625],
    [-0.25, 0.125],
    [-0.6, 0.0625],
    [-0.75, 0.75],
    [-1, 1]
]

logger = rclpy.logging.get_logger("subscriber")

###############################################################################
#ROS Subscriber Node

class JointStateSubscriber(Node):
    def __init__(self):
        super().__init__('joint_state_subscriber')
        self.subscription = self.create_subscription(
            JointState,
            '/joint_states',
            self.listener_callback,
            10
        )
        self.rotations = None

    def listener_callback(self, msg: JointState):
        if len(msg.position) < 6:
            self.get_logger().warn(
                f'only received {len(msg.position)}'
            )
            return
        #Convert radians to rotations
        rotations = [angle / (2 * math.pi) for angle in msg.position[:6]]
        rotations[1] = -rotations[1]
        self.rotations = rotations


###############################################################################
#Motor control functions

async def get_Encoder_Pos():
    r1 = await c1.query()
    pos1 = r1.values[moteus.Register.ENCODER_1_POSITION]
    r2 = await c2.query()
    pos2 = r2.values[moteus.Register.ENCODER_1_POSITION]
    r3 = await c3.query()
    pos3 = r3.values[moteus.Register.ENCODER_1_POSITION]
    r4 = await c4.query()
    pos4 = r4.values[moteus.Register.ENCODER_1_POSITION]
    r5 = await c5.query()
    pos5 = r5.values[moteus.Register.ENCODER_1_POSITION]
    r6 = await c6.query()
    pos6 = r6.values[moteus.Register.ENCODER_1_POSITION]

    #Subtract offsets
    pos1 -= offsets[0]
    pos2 -= offsets[1]
    pos3 -= offsets[2]
    pos4 -= offsets[3]
    pos5 -= offsets[4]
    pos6 -= offsets[5]

    return [pos1, pos2, pos3, pos4, pos5, pos6]

async def get_Motor_Pos():
    r1 = await c1.query()
    pos1 = r1.values[moteus.Register.POSITION]
    r2 = await c2.query()
    pos2 = r2.values[moteus.Register.POSITION]
    r3 = await c3.query()
    pos3 = r3.values[moteus.Register.POSITION]
    r4 = await c4.query()
    pos4 = r4.values[moteus.Register.POSITION]
    r5 = await c5.query()
    pos5 = r5.values[moteus.Register.POSITION]
    r6 = await c6.query()
    pos6 = r6.values[moteus.Register.POSITION]

    return [pos1, pos2, pos3, pos4, pos5, pos6]

async def setPos(motor, pos, accel, velocity):
    #Command a specific motor to a position
    if motor == 1:
        await c1.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)
    elif motor == 2:
        await c2.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)
    elif motor == 3:
        await c3.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)
    elif motor == 4:
        await c4.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)
    elif motor == 5:
        await c5.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)
    elif motor == 6:
        await c6.set_position(position=pos, velocity=0.0, accel_limit=accel, velocity_limit=velocity, query=True)

async def calculate_distance(target_pos, motor):
    motor_positions = await get_Motor_Pos()
    motor_pos = motor_positions[motor - 1]

    encoder_positions = await get_Encoder_Pos()
    encoder_pos = encoder_positions[motor - 1]

    #Choose a ratio based on the motor id
    ratio = 75 if 4 <= motor <= 6 else 131.75

    enc_distance = (target_pos - encoder_pos) * ratio
    new_pos = motor_pos - enc_distance

    return new_pos

async def setPoses(node, p1, p2, p3, p4, p5, p6):
    node.get_logger().info(
        "Output joint commands: [{:.3f}, {:.3f}, {:.3f}, {:.3f}, {:.3f}, {:.3f}]".format(
            p1, p2, p3, p4, p5, p6
        )
    )
    new_pos1 = await calculate_distance(p1, 1)
    new_pos2 = await calculate_distance(p2, 2)
    new_pos3 = await calculate_distance(p3, 3)
    new_pos4 = await calculate_distance(p4, 4)
    new_pos5 = await calculate_distance(p5, 5)
    new_pos6 = await calculate_distance(p6, 6)

    return [new_pos1, new_pos2, new_pos3, new_pos4, new_pos5, new_pos6]

async def limits():
    positions = await get_Encoder_Pos()
    for i in range(6):
        lower_limit, upper_limit = joint_limits[i]
        if positions[i] < lower_limit:
            logger.warn(f"Joint {i+1} out of limits: {positions[i]} is below lower limit ({lower_limit})")
            return False
        elif positions[i] > upper_limit:
            logger.warn(f"Joint {i+1} out of limits: {positions[i]} is above upper limit ({upper_limit})")
            return False
    return True

async def holdPos():
    #Hold motors
    await c1.set_position(position=math.nan, query=True)
    await c2.set_position(position=math.nan, query=True)
    await c3.set_position(position=math.nan, query=True)
    await c4.set_position(position=math.nan, query=True)
    await c5.set_position(position=math.nan, query=True)
    await c6.set_position(position=math.nan, query=True)

###############################################################################
#Joint command loop

async def joint_command_loop(node):
    while not hasattr(node, 'rotations') or node.rotations is None:
        node.get_logger().info("Waiting for joint data")
        await asyncio.sleep(0.1)
    
    while await limits():
        pos = await setPoses(node, *node.rotations)
        # Get current motor positions so that units match.
        current_motor = await get_Motor_Pos()
        threshold = 0.3
        
        if all(abs(current_motor[i] - pos[i]) < threshold for i in range(6)):
            node.get_logger().info("Holding new position")
            await holdPos()
        else:
            await asyncio.gather(
                setPos(1, pos[0], 2, 5),
                setPos(2, pos[1], 2, 5),
                setPos(3, pos[2], 2, 5),
                setPos(4, pos[3], 2, 5),
                setPos(5, pos[4], 2, 5),
                setPos(6, pos[5], 2, 5),
            )
        await asyncio.sleep(0.02)
    
    while True:
        await limits()
        await holdPos()
        await asyncio.sleep(0.02)

###############################################################################
#Main function

async def main(args=None):
    await c1.set_stop()
    await c2.set_stop()
    await c3.set_stop()
    await c4.set_stop()
    await c5.set_stop()
    await c6.set_stop()

    rclpy.init(args=args)
    node = JointStateSubscriber()

    executor = MultiThreadedExecutor()
    executor.add_node(node)

    #Start the joint command loop
    asyncio.create_task(joint_command_loop(node))

    try:
        while rclpy.ok():
            executor.spin_once(timeout_sec=0.1)
            await asyncio.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
