# This script export visible elements positions, scale and rotation in an easy to parse format
# Run this from a text block
import bpy
import os

filename = os.path.abspath(os.path.join(os.path.dirname(bpy.data.filepath), "scene.json"))
print("Writing to: %s" % filename)
text_file = open(filename, "w")

text_file.write("""{ "entities": [\n""")

first = True # Used to avoid final comma

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

    if not first:
        text_file.write(",\n")
    first = False    
    text_file.write("""{ "model": "%s", "pos": [%f, %f, %f], "scale": [%f, %f, %f], "rotation_mode": "%s", "eurot": [%f, %f, %f] }""" % (element.data.name, loc[0], loc[1], loc[2], s[0], s[1], s[2], rm, eu[0], eu[1], eu[2]))

text_file.write("\n]}\n")

text_file.close()
