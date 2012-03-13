<?php
$map = array();
for($y = 0; $y < 160; $y++) {
    for($x = 0; $x < 160; $x++) {
        $map[$x][$y] = array(
            array(1,8),             // background is [0]
            null                    // foreground is [1]
        );
    }
}
echo json_encode($map);
