# This script export visible elements positions, scale and rotation in an easy to parse format
# Cut and paste it in Blender console view
import bpy

scene = bpy.context.scene
for element in bpy.context.scene.objects:
    # "element" is the instance, "element.data" is the underlying data block
    # See here for available properties:
    # https://www.blender.org/api/blender_python_api_2_74_release/bpy.types.Object.html
    if (element.type != "MESH" or not element.is_visible(scene)): continue
    loc = element.location
    s = element.scale
    rm = element.rotation_mode
    if (rm != 'XYZ'): raise Exception('Unhandled rotation mode')
    q = element.rotation_quaternion
    eu = element.rotation_euler
    print("model='%s' pos=(%f, %f, %f) scale=(%f, %f, %f) rotation_mode=%s rot=(%f, %f, %f)" % (element.data.name, loc[0], loc[1], loc[2], s[0], s[1], s[2], rm, eu[0], eu[1], eu[2]))
